use crate::{
    Asset, Error, ImportRequest, Result,
    contracts::{CHUNK, MAX_ASSET_BYTES, MAX_RECORDS, timing},
    database, paths,
    workspace::Workspace,
};
use rusqlite::params;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};

struct Intent {
    id: String,
    asset_id: String,
    project_id: String,
    stage: String,
    final_path: String,
    device: Option<String>,
    inode: Option<String>,
}
fn optional(path: &Path) -> Result<Option<fs::Metadata>> {
    match fs::symlink_metadata(path) {
        Ok(m) => Ok(Some(m)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

impl Workspace {
    pub fn import(
        &mut self,
        request: ImportRequest,
        check: impl Fn() -> Result<()>,
    ) -> Result<Asset> {
        let result = self.import_inner(request, &check);
        match result {
            Ok(asset) => Ok(asset),
            Err(error) => match self.recover() {
                Ok(()) => Err(error),
                Err(recovery) => Err(Error::new(
                    "recovery",
                    format!("{error}; recovery refused: {recovery}"),
                )),
            },
        }
    }
    fn import_inner(
        &mut self,
        request: ImportRequest,
        check: &impl Fn() -> Result<()>,
    ) -> Result<Asset> {
        check()?;
        let reference = paths::derive_ref(&self.id, &request.project_id, &request.asset_id)?;
        paths::validate_ref(&reference, &self.id, &request.asset_id)?;
        database::owner(&self.db, &request.project_id)?;
        let asset_count: i64 = self
            .db
            .query_row("SELECT count(*) FROM assets", [], |r| r.get(0))?;
        if asset_count >= MAX_RECORDS as i64 {
            return Err(Error::new("size", "Asset boundary exceeded"));
        }
        let duplicate: bool = self.db.query_row(
            "SELECT EXISTS(SELECT 1 FROM assets WHERE id=?)",
            [&request.asset_id],
            |r| r.get(0),
        )?;
        if duplicate {
            return Err(Error::new("duplicate", "Asset IDs are immutable"));
        }
        let source_before = paths::ordinary(&request.source, 1)?;
        if source_before.len() == 0 || source_before.len() > MAX_ASSET_BYTES {
            return Err(Error::new("size", "Source byte boundary"));
        }
        let mut input = fs::File::open(&request.source)?;
        if paths::inode(&source_before)? != paths::inode(&input.metadata()?)? {
            return Err(Error::new(
                "changed",
                "Selected source changed while opening",
            ));
        }
        let final_path = paths::managed(&self.root, &reference.relative_path, true)?;
        if optional(&final_path)?.is_some() {
            return Err(Error::new("duplicate", "Managed target already exists"));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let stage_ref = format!("staging/{id}.stage");
        let stage_path = paths::managed(&self.root, &stage_ref, true)?;
        let mut asset = Asset {
            id: request.asset_id,
            project_id: request.project_id,
            kind: request.kind,
            display_name: request.display_name,
            mime_type: request.mime_type,
            byte_length: source_before.len(),
            content_hash: "0".repeat(64),
            reference,
        };
        database::validate_asset(&asset, &self.id)?;
        if let Some(r) = &request.timing {
            timing(r, &asset)?;
        }
        check()?;
        self.db.execute(
            "INSERT INTO intents VALUES (?,?,?,?,?,?,?,NULL,NULL)",
            params![
                id,
                asset.id,
                asset.project_id,
                stage_ref,
                asset.reference.relative_path,
                Option::<String>::None,
                Option::<String>::None
            ],
        )?;
        self.hooks.hit("intent-before-stage")?;
        check()?;
        let mut stage = paths::exclusive(&stage_path)?;
        stage.sync_all()?;
        paths::sync_dir(stage_path.parent().expect("stage parent"))?;
        let (device, inode, _) = paths::inode(&stage.metadata()?)?;
        self.db.execute(
            "UPDATE intents SET device=?,inode=? WHERE id=?",
            params![device.to_string(), inode.to_string(), id],
        )?;
        let mut hash = Sha256::new();
        let mut buffer = vec![0; CHUNK];
        let mut copied = 0_u64;
        loop {
            check()?;
            let n = input.read(&mut buffer)?;
            check()?;
            if n == 0 {
                break;
            }
            copied += n as u64;
            if copied > source_before.len() {
                return Err(Error::new("changed", "Selected source grew during copy"));
            }
            stage.write_all(&buffer[..n])?;
            hash.update(&buffer[..n]);
            if copied == n as u64 {
                self.hooks.hit("partial-copy")?;
            }
            self.hooks.hit("copy-chunk")?;
            std::thread::yield_now();
        }
        check()?;
        let source_after = paths::ordinary(&request.source, 1)?;
        if copied != source_before.len()
            || paths::inode(&source_before)? != paths::inode(&source_after)?
            || source_before.modified()? != source_after.modified()?
        {
            return Err(Error::new("changed", "Selected source changed during copy"));
        }
        stage.sync_all()?;
        asset.content_hash = paths::hex_digest(hash.finalize());
        self.db.execute(
            "UPDATE intents SET byte_length=?,content_hash=? WHERE id=?",
            params![
                i64::try_from(asset.byte_length)
                    .map_err(|_| Error::new("size", "SQLite byte length overflow"))?,
                asset.content_hash,
                id
            ],
        )?;
        check()?;
        database::owner(&self.db, &asset.project_id)?;
        let final_path = paths::managed(&self.root, &asset.reference.relative_path, false)?;
        let m = paths::ordinary(&stage_path, 1)?;
        if paths::inode(&m)?.0 != device || paths::inode(&m)?.1 != inode {
            return Err(Error::new("containment", "Stage identity changed"));
        }
        self.hooks.hit("before-publication")?;
        self.boundary.validate()?;
        check()?;
        let (verified_size, verified_hash) = paths::hash_file(&stage_path, MAX_ASSET_BYTES, check)?;
        if verified_size != asset.byte_length || verified_hash != asset.content_hash {
            return Err(Error::new(
                "corrupt",
                "Stage bytes changed before publication",
            ));
        }
        fs::hard_link(&stage_path, &final_path)?; // Atomic no-overwrite publication on the same filesystem.
        paths::sync_dir(final_path.parent().expect("final parent"))?;
        self.hooks.hit("link-before-unlink")?;
        fs::remove_file(&stage_path)?;
        paths::sync_dir(stage_path.parent().expect("stage parent"))?;
        self.hooks.hit("published")?;
        check()?;
        let (verified_size, verified_hash) = paths::hash_file(&final_path, MAX_ASSET_BYTES, check)?;
        if verified_size != asset.byte_length || verified_hash != asset.content_hash {
            return Err(Error::new("corrupt", "Published bytes failed verification"));
        }
        let verified_metadata = paths::ordinary(&final_path, 1)?;
        let transaction = self.db.transaction()?;
        database::owner(&transaction, &asset.project_id)?;
        database::insert_asset(&transaction, &asset, request.timing.as_ref())?;
        transaction.execute("DELETE FROM intents WHERE id=?", [&id])?;
        self.hooks.hit("precommit")?;
        self.boundary.validate()?;
        let commit_metadata = paths::ordinary(&final_path, 1)?;
        if paths::inode(&commit_metadata)? != paths::inode(&verified_metadata)?
            || commit_metadata.len() != asset.byte_length
            || commit_metadata.modified()? != verified_metadata.modified()?
        {
            return Err(Error::new(
                "changed",
                "Published bytes changed before actual commit",
            ));
        }
        database::owner(&transaction, &asset.project_id)?;
        check()?; // The actual COMMIT boundary, after hooks/callbacks/staging.
        transaction.commit()?;
        // Late cancellation cannot relabel this committed result. The hook may pause/kill;
        // test-hook errors after commit are diagnostic only and must not undo authority.
        let _ = self.hooks.hit("postcommit");
        Ok(asset)
    }

    pub fn recover(&mut self) -> Result<()> {
        let intents = self.db.prepare("SELECT id,asset_id,project_id,stage,final_path,device,inode FROM intents ORDER BY id")?.query_map([], |r| Ok(Intent{id:r.get(0)?,asset_id:r.get(1)?,project_id:r.get(2)?,stage:r.get(3)?,final_path:r.get(4)?,device:r.get(5)?,inode:r.get(6)?}))?.collect::<std::result::Result<Vec<_>,_>>()?;
        for intent in intents {
            if uuid::Uuid::parse_str(&intent.id)
                .map(|u| u.to_string() != intent.id)
                .unwrap_or(true)
                || intent.stage != format!("staging/{}.stage", intent.id)
            {
                return Err(Error::new("recovery", "Noncanonical pending intent"));
            }
            let reference = paths::derive_ref(&self.id, &intent.project_id, &intent.asset_id)?;
            paths::validate_ref(&reference, &self.id, &intent.asset_id)?;
            if reference.relative_path != intent.final_path {
                return Err(Error::new("recovery", "Pending path ownership mismatch"));
            }
            let committed: bool = self.db.query_row(
                "SELECT EXISTS(SELECT 1 FROM assets WHERE id=? OR relative_path=?)",
                params![intent.asset_id, intent.final_path],
                |r| r.get(0),
            )?;
            if committed {
                return Err(Error::new(
                    "recovery",
                    "Ambiguous committed/pending identity",
                ));
            }
            let stage = paths::managed(&self.root, &intent.stage, false)?;
            let final_path = paths::managed(&self.root, &intent.final_path, false)?;
            let stage_meta = optional(&stage)?;
            let final_meta = optional(&final_path)?;
            if stage_meta.is_some() || final_meta.is_some() {
                let dev = intent
                    .device
                    .as_deref()
                    .and_then(|v| v.parse::<u64>().ok())
                    .ok_or_else(|| {
                        Error::new("recovery", "Unproven stage device; preserve bytes")
                    })?;
                let ino = intent
                    .inode
                    .as_deref()
                    .and_then(|v| v.parse::<u64>().ok())
                    .ok_or_else(|| {
                        Error::new("recovery", "Unproven stage inode; preserve bytes")
                    })?;
                let links = if stage_meta.is_some() && final_meta.is_some() {
                    2
                } else {
                    1
                };
                for metadata in [&stage_meta, &final_meta].into_iter().flatten() {
                    if !metadata.is_file()
                        || metadata.file_type().is_symlink()
                        || paths::inode(metadata)? != (dev, ino, links)
                    {
                        return Err(Error::new(
                            "recovery",
                            "Pending file identity/link ambiguity; preserve bytes",
                        ));
                    }
                }
                if stage_meta.is_some() {
                    fs::remove_file(&stage)?;
                    paths::sync_dir(stage.parent().expect("stage parent"))?;
                }
                if final_meta.is_some() {
                    fs::remove_file(&final_path)?;
                    paths::sync_dir(final_path.parent().expect("final parent"))?;
                }
            }
            self.db
                .execute("DELETE FROM intents WHERE id=?", [&intent.id])?;
        }
        Ok(())
    }
}
