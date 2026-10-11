use crate::{
    BackupManifest, Error, Hooks, ReadyMarker, Result, SCHEMA, contracts::MAX_ASSET_BYTES,
    database, paths, workspace::Workspace,
};
use rusqlite::backup::{Backup, StepResult};
use std::{
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

const FORMAT: &str = "cuepoint.native-backup.v1";
impl Workspace {
    pub fn backup(
        &self,
        destination: &Path,
        check: impl Fn() -> Result<()>,
    ) -> Result<BackupManifest> {
        check()?;
        let root = paths::reserve(destination)?;
        let database_path = root.join("metadata.sqlite");
        let mut destination = database::connect(&database_path, true, false)?;
        let started = Instant::now();
        {
            let backup = Backup::new(&self.db, &mut destination)?;
            loop {
                check()?;
                self.hooks.hit("backup-step")?;
                if started.elapsed() > Duration::from_secs(30) {
                    return Err(Error::new(
                        "timeout",
                        "SQLite backup exceeded bounded step/retry time",
                    ));
                }
                match backup.step(32)? {
                    StepResult::Done => break,
                    StepResult::More => std::thread::yield_now(),
                    StepResult::Busy | StepResult::Locked => {
                        std::thread::sleep(Duration::from_millis(5))
                    }
                    _ => return Err(Error::new("sqlite", "Unknown backup step result")),
                }
            }
        }
        let state = database::validate(&destination)?;
        let pending: i64 =
            destination.query_row("SELECT count(*) FROM intents", [], |r| r.get(0))?;
        if pending != 0 || state.workspace_id != self.id {
            return Err(Error::new("backup", "Snapshot is not a complete workspace"));
        }
        drop(destination);
        paths::ordinary(&database_path, 1)?;
        std::fs::File::open(&database_path)?.sync_all()?;
        for asset in &state.assets {
            check()?;
            let source = paths::managed(&self.root, &asset.reference.relative_path, false)?;
            let target = paths::managed(&root, &asset.reference.relative_path, true)?;
            paths::copy_verified(
                &source,
                &target,
                asset.byte_length,
                &asset.content_hash,
                &check,
            )?;
        }
        let (database_bytes, database_hash) =
            paths::hash_file(&database_path, MAX_ASSET_BYTES, &check)?;
        let manifest = BackupManifest {
            format: FORMAT.into(),
            schema: SCHEMA,
            workspace_id: self.id.clone(),
            database_bytes,
            database_hash,
            assets: state.assets,
        };
        self.hooks.hit("backup-before-completion")?;
        verify_snapshot(&root, &manifest, &check)?;
        self.boundary.validate()?;
        check()?;
        paths::publish_json(&root, "backup.complete.json", &manifest)?;
        let _ = self.hooks.hit("backup-after-completion");
        // Completion publication succeeded: a later cancel reports success.
        Ok(manifest)
    }
}

fn verify(backup_root: &Path) -> Result<BackupManifest> {
    let manifest: BackupManifest = paths::read_json(&backup_root.join("backup.complete.json"))?;
    verify_snapshot(backup_root, &manifest, &|| Ok(()))?;
    Ok(manifest)
}

fn verify_snapshot(
    backup_root: &Path,
    manifest: &BackupManifest,
    check: &impl Fn() -> Result<()>,
) -> Result<()> {
    check()?;
    if manifest.format != FORMAT || manifest.schema != SCHEMA {
        return Err(Error::new("schema", "Unsupported backup format"));
    }
    let database_path = paths::managed(backup_root, "metadata.sqlite", false)?;
    let (size, hash) = paths::hash_file(&database_path, MAX_ASSET_BYTES, check)?;
    if size != manifest.database_bytes || hash != manifest.database_hash {
        return Err(Error::new("corrupt", "Backup database hash/size mismatch"));
    }
    let database = database::connect(&database_path, false, true)?;
    let state = database::validate(&database)?;
    let pending: i64 = database.query_row("SELECT count(*) FROM intents", [], |r| r.get(0))?;
    if pending != 0
        || manifest.workspace_id != state.workspace_id
        || manifest.assets != state.assets
    {
        return Err(Error::new(
            "closure",
            "Backup manifest/database closure mismatch",
        ));
    }
    for asset in &manifest.assets {
        check()?;
        let source = paths::managed(backup_root, &asset.reference.relative_path, false)?;
        let (size, hash) = paths::hash_file(&source, MAX_ASSET_BYTES, check)?;
        if size != asset.byte_length || hash != asset.content_hash {
            return Err(Error::new("corrupt", "Backup asset hash/size mismatch"));
        }
    }
    check()?;
    Ok(())
}

pub(crate) fn restore(backup_root: &Path, destination: &Path, hooks: &Hooks) -> Result<PathBuf> {
    let backup_root = paths::canonical_root(backup_root)?;
    let manifest = verify(&backup_root)?;
    let root = paths::reserve(destination)?;
    // No ready marker until all files and schema are independently verified.
    paths::copy_verified(
        &backup_root.join("metadata.sqlite"),
        &root.join("metadata.sqlite"),
        manifest.database_bytes,
        &manifest.database_hash,
        || Ok(()),
    )?;
    for asset in &manifest.assets {
        let source = paths::managed(&backup_root, &asset.reference.relative_path, false)?;
        let target = paths::managed(&root, &asset.reference.relative_path, true)?;
        paths::copy_verified(
            &source,
            &target,
            asset.byte_length,
            &asset.content_hash,
            || Ok(()),
        )?;
    }
    let db = database::connect(&root.join("metadata.sqlite"), false, true)?;
    let state = database::validate(&db)?;
    if state.workspace_id != manifest.workspace_id || state.assets != manifest.assets {
        return Err(Error::new("closure", "Restored snapshot changed"));
    }
    drop(db);
    hooks.hit("restore-before-completion")?;
    verify_snapshot(&root, &manifest, &|| Ok(()))?;
    paths::publish_json(
        &root,
        "workspace.ready.json",
        &ReadyMarker {
            format: "cuepoint.workspace.ready.v1".into(),
            schema: SCHEMA,
            workspace_id: manifest.workspace_id,
        },
    )?;
    let _ = hooks.hit("restore-after-completion");
    Ok(root)
}
