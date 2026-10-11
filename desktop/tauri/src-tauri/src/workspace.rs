use crate::{
    AssetAvailability, Availability, Error, Hooks, Job, Outcome, ReadyMarker, Result, SCHEMA,
    State, database, paths,
};
use rusqlite::{Connection, params};
use std::{fs, io::Read, path::PathBuf};

pub(crate) struct Workspace {
    pub root: PathBuf,
    pub db: Connection,
    pub writer: Connection,
    pub id: String,
    pub hooks: Hooks,
    pub boundary: Boundary,
}
pub(crate) struct Boundary {
    root: PathBuf,
    root_inode: (u64, u64),
    database_inode: (u64, u64),
    writer_inode: (u64, u64),
}
impl Boundary {
    fn capture(root: &std::path::Path) -> Result<Self> {
        let identity = |metadata: fs::Metadata| -> Result<(u64, u64)> {
            let (dev, ino, _) = paths::inode(&metadata)?;
            Ok((dev, ino))
        };
        Ok(Self {
            root: root.to_path_buf(),
            root_inode: identity(fs::symlink_metadata(root)?)?,
            database_inode: identity(paths::ordinary(&root.join("metadata.sqlite"), 1)?)?,
            writer_inode: identity(paths::ordinary(&root.join("writer.sqlite"), 1)?)?,
        })
    }
    pub fn validate(&self) -> Result<()> {
        paths::canonical_root(&self.root)?;
        database::check_files(&self.root.join("metadata.sqlite"))?;
        database::check_files(&self.root.join("writer.sqlite"))?;
        for (metadata, expected) in [
            (fs::symlink_metadata(&self.root)?, self.root_inode),
            (
                paths::ordinary(&self.root.join("metadata.sqlite"), 1)?,
                self.database_inode,
            ),
            (
                paths::ordinary(&self.root.join("writer.sqlite"), 1)?,
                self.writer_inode,
            ),
        ] {
            let (dev, ino, _) = paths::inode(&metadata)?;
            if (dev, ino) != expected {
                return Err(Error::new(
                    "containment",
                    "Opened workspace or database was replaced",
                ));
            }
        }
        Ok(())
    }
}
impl Workspace {
    pub fn open(root: PathBuf, create: bool, hooks: Hooks) -> Result<Self> {
        let root = if create {
            paths::reserve(&root)?
        } else {
            paths::canonical_root(&root)?
        };
        let ready = if create {
            None
        } else {
            Some(paths::read_json::<ReadyMarker>(
                &root.join("workspace.ready.json"),
            )?)
        };
        let writer_path = root.join("writer.sqlite");
        let create_writer = match fs::symlink_metadata(&writer_path) {
            Ok(_) => false,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => true,
            Err(e) => return Err(e.into()),
        };
        let writer = database::connect(&writer_path, create_writer, false)?;
        writer.execute_batch("BEGIN EXCLUSIVE")?;
        let db = database::connect(&root.join("metadata.sqlite"), create, false)?;
        if create {
            database::initialize(&db, &uuid::Uuid::new_v4().to_string())?;
            paths::sync_dir(&root)?;
        }
        let state = database::validate(&db)?;
        if let Some(marker) = ready
            && (marker.format != "cuepoint.workspace.ready.v1"
                || marker.schema != SCHEMA
                || marker.workspace_id != state.workspace_id)
        {
            return Err(Error::new(
                "incomplete",
                "Workspace completion marker mismatch",
            ));
        }
        let boundary = Boundary::capture(&root)?;
        let mut workspace = Self {
            root,
            db,
            writer,
            id: state.workspace_id,
            hooks,
            boundary,
        };
        workspace.recover()?;
        if create {
            paths::publish_json(
                &workspace.root,
                "workspace.ready.json",
                &ReadyMarker {
                    format: "cuepoint.workspace.ready.v1".into(),
                    schema: SCHEMA,
                    workspace_id: workspace.id.clone(),
                },
            )?;
        }
        Ok(workspace)
    }
    pub fn state(&self) -> Result<State> {
        database::validate(&self.db)
    }
    pub fn run(&mut self, job: Job, check: impl Fn() -> Result<()>) -> Result<Outcome> {
        check()?;
        // Revalidate managed DB files before every operation. Hostile replacement between
        // these checks and OS opens is outside this prototype's proven protection.
        self.boundary.validate()?;
        match job {
            Job::State => Ok(Outcome::State(self.state()?)),
            Job::SaveProject(project) => {
                database::validate_project(&project)?;
                let count: i64 = self
                    .db
                    .query_row("SELECT count(*) FROM projects", [], |r| r.get(0))?;
                let existing: bool = self.db.query_row(
                    "SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",
                    [&project.id],
                    |r| r.get(0),
                )?;
                if !existing && count >= crate::contracts::MAX_RECORDS as i64 {
                    return Err(Error::new("size", "Project boundary"));
                }
                let transaction = self.db.transaction()?;
                transaction.execute("INSERT INTO projects VALUES (?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title",params![project.id,project.title])?;
                self.hooks.hit("project-precommit")?;
                self.boundary.validate()?;
                check()?;
                transaction.commit()?;
                Ok(Outcome::Project(project))
            }
            Job::Import(request) => Ok(Outcome::Asset(self.import(request, check)?)),
            Job::Availability => {
                let state = self.state()?;
                let mut result = Vec::new();
                for asset in state.assets {
                    check()?;
                    let path = paths::managed(&self.root, &asset.reference.relative_path, false);
                    let status = match path.and_then(|p| {
                        paths::hash_file(&p, crate::contracts::MAX_ASSET_BYTES, &check)
                    }) {
                        Ok((size, hash))
                            if size == asset.byte_length && hash == asset.content_hash =>
                        {
                            Availability::Present
                        }
                        Err(e)
                            if e.code == "io"
                                && !self.root.join(&asset.reference.relative_path).exists() =>
                        {
                            Availability::Missing
                        }
                        Err(e) if e.code == "canceled" || e.code == "closed" => return Err(e),
                        _ => Availability::Corrupt,
                    };
                    result.push(AssetAvailability {
                        asset_id: asset.id,
                        status,
                    });
                }
                Ok(Outcome::Availability(result))
            }
            Job::Backup(destination) => Ok(Outcome::Backup(self.backup(&destination, check)?)),
            Job::ReadAsset {
                asset_id,
                max_bytes,
            } => {
                if max_bytes > 32 * 1024 * 1024 {
                    return Err(Error::new("size", "Bounded fixture read is at most 32 MiB"));
                }
                let asset = self
                    .state()?
                    .assets
                    .into_iter()
                    .find(|a| a.id == asset_id)
                    .ok_or_else(|| Error::new("missing", "Asset ID missing"))?;
                if asset.byte_length > max_bytes as u64 {
                    return Err(Error::new("size", "Asset exceeds requested read boundary"));
                }
                let path = paths::managed(&self.root, &asset.reference.relative_path, false)?;
                let mut file = fs::File::open(&path)?;
                paths::ordinary(&path, 1)?;
                let mut bytes = Vec::with_capacity(asset.byte_length as usize);
                let mut buffer = vec![0; crate::CHUNK];
                let mut hash = <sha2::Sha256 as sha2::Digest>::new();
                loop {
                    check()?;
                    let n = file.read(&mut buffer)?;
                    if n == 0 {
                        break;
                    }
                    if bytes.len() + n > max_bytes {
                        return Err(Error::new("size", "Observed read boundary exceeded"));
                    }
                    sha2::Digest::update(&mut hash, &buffer[..n]);
                    bytes.extend_from_slice(&buffer[..n]);
                }
                if bytes.len() as u64 != asset.byte_length
                    || paths::hex_digest(sha2::Digest::finalize(hash)) != asset.content_hash
                {
                    return Err(Error::new("corrupt", "Managed bytes failed verification"));
                }
                check()?;
                Ok(Outcome::Bytes(bytes))
            }
        }
    }
    pub fn close(&mut self) -> Result<()> {
        self.writer.execute_batch("ROLLBACK")?;
        Ok(())
    }
}
