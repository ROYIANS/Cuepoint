use crate::{
    AssetAvailability, Availability, Beat, Episode, Error, Hooks, Job, Outcome, ReadyMarker,
    Result, SCHEMA, Shot, State, database, paths,
};
use rusqlite::{Connection, params};
use std::{
    collections::BTreeSet,
    fs,
    io::Read,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

pub(crate) struct Workspace {
    pub root: PathBuf,
    pub db: Connection,
    pub writer: Connection,
    pub id: String,
    pub hooks: Hooks,
    pub boundary: Boundary,
}

fn stamp() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{millis}")
}

fn validate_episode_input(state: &State, episode: &Episode) -> Result<()> {
    let mut episodes: Vec<_> = state
        .episodes
        .iter()
        .filter(|e| e.id != episode.id)
        .cloned()
        .collect();
    episodes.push(episode.clone());
    database::validate_video_rows(
        &state.projects,
        &state.video_projects,
        &episodes,
        &state.beats,
        &state.shots,
        false,
    )
}
fn validate_beat_input(state: &State, beat: &Beat) -> Result<()> {
    let mut beats: Vec<_> = state
        .beats
        .iter()
        .filter(|b| b.id != beat.id)
        .cloned()
        .collect();
    beats.push(beat.clone());
    database::validate_video_rows(
        &state.projects,
        &state.video_projects,
        &state.episodes,
        &beats,
        &state.shots,
        false,
    )
}
fn validate_shot_input(state: &State, shot: &Shot) -> Result<()> {
    let mut shots: Vec<_> = state
        .shots
        .iter()
        .filter(|s| s.id != shot.id)
        .cloned()
        .collect();
    shots.push(shot.clone());
    database::validate_video_rows(
        &state.projects,
        &state.video_projects,
        &state.episodes,
        &state.beats,
        &shots,
        false,
    )
}

fn video_state(state: &State, project_id: &str) -> Result<crate::VideoWorkspaceState> {
    let project = state
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .cloned()
        .ok_or_else(|| Error::new("missing", "Project missing"))?;
    let video = state
        .video_projects
        .iter()
        .find(|p| p.project_id == project_id)
        .cloned()
        .ok_or_else(|| Error::new("missing", "Video project missing"))?;
    let episodes: Vec<_> = state
        .episodes
        .iter()
        .filter(|e| e.project_id == project_id)
        .cloned()
        .collect();
    let episode_ids: BTreeSet<_> = episodes.iter().map(|e| e.id.as_str()).collect();
    let beats: Vec<_> = state
        .beats
        .iter()
        .filter(|b| episode_ids.contains(b.episode_id.as_str()))
        .cloned()
        .collect();
    let shots: Vec<_> = state
        .shots
        .iter()
        .filter(|s| s.project_id == project_id)
        .cloned()
        .collect();
    let mut referenced_asset_ids: Vec<_> = state
        .references
        .iter()
        .filter(|r| r.project_id == project_id)
        .map(|r| r.asset_id.clone())
        .collect();
    referenced_asset_ids.sort();
    referenced_asset_ids.dedup();
    Ok(crate::VideoWorkspaceState {
        project,
        video,
        episodes,
        beats,
        shots,
        referenced_asset_ids,
    })
}

fn reorder(
    db: &mut Connection,
    table: &str,
    owner_column: &str,
    owner: &str,
    ordered_ids: Vec<String>,
) -> Result<()> {
    if ordered_ids.len() > crate::contracts::MAX_RECORDS {
        return Err(Error::new("size", "Order boundary"));
    }
    let allowed = format!("SELECT id FROM {table} WHERE {owner_column}=? ORDER BY item_order,id");
    let expected: Vec<String> = db
        .prepare(&allowed)?
        .query_map([owner], |r| r.get(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let expected_set: BTreeSet<_> = expected.iter().collect();
    let actual_set: BTreeSet<_> = ordered_ids.iter().collect();
    if expected.len() != ordered_ids.len()
        || expected_set != actual_set
        || ordered_ids.iter().collect::<BTreeSet<_>>().len() != ordered_ids.len()
    {
        return Err(Error::new(
            "order",
            "Order list must contain every owned row exactly once",
        ));
    }
    let tx = db.unchecked_transaction()?;
    for (index, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            &format!("UPDATE {table} SET item_order=? WHERE id=? AND {owner_column}=?"),
            params![index as i64 + 1_000_000_i64, id, owner],
        )?;
    }
    for (index, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            &format!("UPDATE {table} SET item_order=? WHERE id=? AND {owner_column}=?"),
            params![index as i64, id, owner],
        )?;
    }
    tx.commit()?;
    Ok(())
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
        database::validate_state_closure(&state)?;
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
                transaction.execute("INSERT INTO video_projects (project_id,mode,logline,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id) DO NOTHING", params![project.id, "film", "", stamp()])?;
                let has_episode: bool = transaction.query_row(
                    "SELECT EXISTS(SELECT 1 FROM episodes WHERE project_id=?)",
                    [&project.id],
                    |r| r.get(0),
                )?;
                if !has_episode {
                    transaction.execute("INSERT INTO episodes (id,project_id,item_order,title,logline,script,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)", params![uuid::Uuid::new_v4().to_string(), project.id, 0_i64, "第一集", "", "", stamp(), stamp()])?;
                }
                self.hooks.hit("project-precommit")?;
                self.boundary.validate()?;
                check()?;
                transaction.commit()?;
                Ok(Outcome::Project(project))
            }
            Job::SaveVideoProject(video) => {
                let state = self.state()?;
                database::validate_video_project(&video, &state.projects)?;
                let tx = self.db.transaction()?;
                tx.execute("INSERT INTO video_projects (project_id,mode,logline,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET mode=excluded.mode,logline=excluded.logline,updated_at=excluded.updated_at", params![video.project_id, video.mode, video.logline, video.updated_at])?;
                tx.commit()?;
                Ok(Outcome::VideoProject(video))
            }
            Job::VideoState(project_id) => Ok(Outcome::VideoState(video_state(
                &self.state()?,
                &project_id,
            )?)),
            Job::SaveEpisode(episode) => {
                let state = self.state()?;
                validate_episode_input(&state, &episode)?;
                let tx = self.db.transaction()?;
                tx.execute("INSERT INTO episodes (id,project_id,item_order,title,logline,script,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,item_order=excluded.item_order,title=excluded.title,logline=excluded.logline,script=excluded.script,created_at=excluded.created_at,updated_at=excluded.updated_at", params![episode.id,episode.project_id,episode.order as i64,episode.title,episode.logline,episode.script,episode.created_at,episode.updated_at])?;
                tx.commit()?;
                Ok(Outcome::Episode(episode))
            }
            Job::ReorderEpisodes {
                project_id,
                ordered_ids,
            } => {
                reorder(
                    &mut self.db,
                    "episodes",
                    "project_id",
                    &project_id,
                    ordered_ids,
                )?;
                Ok(Outcome::VideoState(video_state(
                    &self.state()?,
                    &project_id,
                )?))
            }
            Job::SaveBeat(beat) => {
                let state = self.state()?;
                validate_beat_input(&state, &beat)?;
                let tx = self.db.transaction()?;
                tx.execute("INSERT INTO beats (id,episode_id,item_order,title,content,time_of_day,script_start,script_end) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET episode_id=excluded.episode_id,item_order=excluded.item_order,title=excluded.title,content=excluded.content,time_of_day=excluded.time_of_day,script_start=excluded.script_start,script_end=excluded.script_end", params![beat.id,beat.episode_id,beat.order as i64,beat.title,beat.content,beat.time_of_day,beat.script_start.map(i64::from),beat.script_end.map(i64::from)])?;
                tx.commit()?;
                Ok(Outcome::Beat(beat))
            }
            Job::ReorderBeats {
                episode_id,
                ordered_ids,
            } => {
                reorder(
                    &mut self.db,
                    "beats",
                    "episode_id",
                    &episode_id,
                    ordered_ids,
                )?;
                let project_id = self
                    .state()?
                    .episodes
                    .iter()
                    .find(|e| e.id == episode_id)
                    .map(|e| e.project_id.clone())
                    .ok_or_else(|| Error::new("missing", "Episode missing"))?;
                Ok(Outcome::VideoState(video_state(
                    &self.state()?,
                    &project_id,
                )?))
            }
            Job::SaveShot(shot) => {
                let state = self.state()?;
                validate_shot_input(&state, &shot)?;
                let tx = self.db.transaction()?;
                tx.execute("INSERT INTO shots (id,project_id,episode_id,item_order,shot_number,beat_id,status,duration_sec,content,notes,scene_closeup,sound,emotion,camera_angle,camera_gear,focal_length) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,episode_id=excluded.episode_id,item_order=excluded.item_order,shot_number=excluded.shot_number,beat_id=excluded.beat_id,status=excluded.status,duration_sec=excluded.duration_sec,content=excluded.content,notes=excluded.notes,scene_closeup=excluded.scene_closeup,sound=excluded.sound,emotion=excluded.emotion,camera_angle=excluded.camera_angle,camera_gear=excluded.camera_gear,focal_length=excluded.focal_length", params![shot.id,shot.project_id,shot.episode_id,shot.order as i64,shot.shot_number as i64,shot.beat_id,shot.status,shot.duration_sec,shot.content,shot.notes,shot.scene_closeup,shot.sound,shot.emotion,shot.camera_angle,shot.camera_gear,shot.focal_length])?;
                tx.commit()?;
                Ok(Outcome::Shot(shot))
            }
            Job::ReorderShots {
                episode_id,
                ordered_ids,
            } => {
                reorder(
                    &mut self.db,
                    "shots",
                    "episode_id",
                    &episode_id,
                    ordered_ids,
                )?;
                let project_id = self
                    .state()?
                    .episodes
                    .iter()
                    .find(|e| e.id == episode_id)
                    .map(|e| e.project_id.clone())
                    .ok_or_else(|| Error::new("missing", "Episode missing"))?;
                Ok(Outcome::VideoState(video_state(
                    &self.state()?,
                    &project_id,
                )?))
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
