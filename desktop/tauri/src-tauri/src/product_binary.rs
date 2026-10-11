//! Full-product managed bytes. Row authority belongs to the shared store's final
//! SQLite transaction; a sealed file alone is never a completed product result.
use crate::{Error, Result, contracts::CHUNK, paths};
use rusqlite::{Connection, OptionalExtension, Transaction, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, Metadata},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime},
};

pub const BINARY_SCHEMA: &str = r#"
CREATE TABLE product_binary_intents (
 stage_id TEXT PRIMARY KEY, binary_id TEXT NOT NULL UNIQUE,
 byte_length INTEGER NOT NULL CHECK(byte_length>=0), mime_type TEXT NOT NULL,
 content_hash TEXT, state TEXT NOT NULL CHECK(state IN ('writing','published')),
 device TEXT, inode TEXT
) STRICT;
CREATE TABLE product_binaries (
 binary_id TEXT PRIMARY KEY, byte_length INTEGER NOT NULL CHECK(byte_length>=0),
 mime_type TEXT NOT NULL, content_hash TEXT NOT NULL,
 operation_id TEXT NOT NULL, device TEXT NOT NULL, inode TEXT NOT NULL
) STRICT;
"#;
const MAX_ACTIVE_WRITES: usize = 2;
const MAX_ACTIVE_READS: usize = 8;
const IDLE: Duration = Duration::from_secs(120);
const JS_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ManagedBinaryRef {
    pub version: u32,
    pub workspace_id: String,
    pub binary_id: String,
    pub byte_length: u64,
    pub mime_type: String,
    pub content_hash: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct BinaryClaim {
    pub reference: ManagedBinaryRef,
    pub stage_id: String,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum BinaryRequest {
    Prepare {
        byte_length: u64,
        mime_type: String,
    },
    Write {
        stage_id: String,
        offset: u64,
        bytes: Vec<u8>,
    },
    Seal {
        stage_id: String,
        content_hash: String,
    },
    Abort {
        stage_id: String,
    },
    Availability {
        reference: ManagedBinaryRef,
    },
    ReadStart {
        reference: ManagedBinaryRef,
    },
    ReadChunk {
        lease_id: String,
        offset: u64,
        byte_length: usize,
    },
    ReadVerify {
        lease_id: String,
    },
    ReadClose {
        lease_id: String,
    },
    Reap,
}
#[derive(Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum BinaryReply {
    Prepared {
        stage_id: String,
        binary_id: String,
        workspace_id: String,
        chunk_bytes: usize,
    },
    Progress {
        offset: u64,
    },
    Sealed {
        claim: BinaryClaim,
    },
    Aborted {
        found: bool,
    },
    Availability {
        state: BinaryAvailability,
    },
    ReadReady {
        lease_id: String,
        reference: ManagedBinaryRef,
        chunk_bytes: usize,
    },
    Bytes {
        bytes: Vec<u8>,
        offset: u64,
        end: bool,
    },
    Verified,
    Closed {
        found: bool,
    },
    Reaped,
}
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BinaryAvailability {
    Ready,
    Missing,
    Corrupt,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct FileIdentity {
    device: u64,
    inode: u64,
    byte_length: u64,
    modified: SystemTime,
}
impl FileIdentity {
    fn of(metadata: &Metadata) -> Result<Self> {
        let (device, inode, links) = paths::inode(metadata)?;
        if !metadata.is_file() || metadata.file_type().is_symlink() || links != 1 {
            return Err(Error::new(
                "containment",
                "Binary must be an ordinary owned file",
            ));
        }
        Ok(Self {
            device,
            inode,
            byte_length: metadata.len(),
            modified: metadata.modified()?,
        })
    }
    fn check(&self, path: &Path, file: &File) -> Result<()> {
        if Self::of(&ordinary(path)?)? != *self || Self::of(&file.metadata()?)? != *self {
            return Err(Error::new(
                "changed",
                "Managed bytes changed during the operation",
            ));
        }
        Ok(())
    }
}
#[derive(Clone)]
struct ManagedLocation {
    root: PathBuf,
    root_identity: (u64, u64),
    relative: String,
}
impl ManagedLocation {
    fn resolve(&self, create_parents: bool) -> Result<PathBuf> {
        let validate_root = || -> Result<()> {
            let metadata = fs::symlink_metadata(&self.root)?;
            let (device, inode, _) = paths::inode(&metadata)?;
            if !metadata.is_dir()
                || metadata.file_type().is_symlink()
                || (device, inode) != self.root_identity
            {
                return Err(Error::new(
                    "containment",
                    "Binary workspace root identity changed",
                ));
            }
            Ok(())
        };
        validate_root()?;
        let path = paths::managed(&self.root, &self.relative, create_parents)?;
        validate_root()?;
        Ok(path)
    }
}
struct WriteStage {
    file: File,
    path: PathBuf,
    location: ManagedLocation,
    binary_id: String,
    byte_length: u64,
    mime_type: String,
    device: u64,
    inode: u64,
    written: u64,
    hash: Sha256,
    progressed: Instant,
}
struct ReadLease {
    file: File,
    location: ManagedLocation,
    reference: ManagedBinaryRef,
    identity: FileIdentity,
    progressed: Instant,
}
/// Verified playback handle. A renderer receives only a separate opaque URL.
/// Each protocol response is bounded and rechecks current containment/identity.
pub struct PlaybackFile {
    location: ManagedLocation,
    retired: bool,
    file: File,
    reference: ManagedBinaryRef,
    identity: FileIdentity,
}
/// Private authority minted only from a whole-hash-verified playback handle.
/// It holds no descriptor and exposes no filesystem path or serialization.
#[derive(Clone)]
pub struct PlaybackAuthority {
    location: ManagedLocation,
    reference: ManagedBinaryRef,
    identity: FileIdentity,
}
impl PlaybackAuthority {
    pub fn reference(&self) -> &ManagedBinaryRef {
        &self.reference
    }
    pub fn open_checked(&self) -> Result<PlaybackFile> {
        let path = self.location.resolve(false)?;
        // Never re-authorize changed bytes merely because the ID/size matches.
        // Both named entry and actual opened descriptor must equal the original
        // root/device/inode/length/mtime proof before any representation read.
        if FileIdentity::of(&ordinary(&path)?)? != self.identity {
            return Err(Error::new("changed", "Playback authority identity changed"));
        }
        let file = File::open(&path)?;
        let current = self.location.resolve(false)?;
        self.identity.check(&current, &file)?;
        Ok(PlaybackFile {
            location: self.location.clone(),
            retired: false,
            file,
            reference: self.reference.clone(),
            identity: self.identity.clone(),
        })
    }
}
impl PlaybackFile {
    pub fn into_authority(self) -> PlaybackAuthority {
        // Moving the proof out deliberately drops this verified descriptor.
        PlaybackAuthority {
            location: self.location,
            reference: self.reference,
            identity: self.identity,
        }
    }
    pub fn reference(&self) -> &ManagedBinaryRef {
        &self.reference
    }
    pub fn read_chunk(&mut self, offset: u64, byte_length: usize) -> Result<Vec<u8>> {
        if byte_length == 0 || byte_length > CHUNK || offset > self.reference.byte_length {
            return Err(Error::new("size", "Playback range boundary exceeded"));
        }
        if self.retired {
            return Err(Error::new("expired", "Playback handle is retired"));
        }
        let result = (|| {
            let path = self.location.resolve(false)?;
            self.identity.check(&path, &self.file)?;
            let size = (self.reference.byte_length - offset).min(byte_length as u64) as usize;
            let mut bytes = vec![0; size];
            self.file.seek(SeekFrom::Start(offset))?;
            self.file.read_exact(&mut bytes)?;
            let current = self.location.resolve(false)?;
            self.identity.check(&current, &self.file)?;
            Ok(bytes)
        })();
        if result.is_err() {
            self.retired = true;
        }
        result
    }
}
pub struct VerifiedClaim {
    claim: BinaryClaim,
    location: ManagedLocation,
    identity: FileIdentity,
}
pub struct BinaryStore {
    root: PathBuf,
    root_identity: (u64, u64),
    workspace_id: String,
    writes: HashMap<String, WriteStage>,
    reads: HashMap<String, ReadLease>,
}

fn sql_length(row: &rusqlite::Row<'_>, index: usize) -> rusqlite::Result<u64> {
    let value = row.get::<_, i64>(index)?;
    u64::try_from(value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            index,
            rusqlite::types::Type::Integer,
            Box::new(error),
        )
    })
}
fn canonical_uuid(value: &str) -> bool {
    uuid::Uuid::parse_str(value).is_ok_and(|id| id.to_string() == value)
}
fn hash_valid(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn metadata_valid(byte_length: u64, mime_type: &str) -> Result<()> {
    if byte_length > JS_SAFE_INTEGER
        || mime_type.len() > 256
        || mime_type.chars().any(char::is_control)
    {
        return Err(Error::new("wire", "Invalid managed binary metadata"));
    }
    Ok(())
}
pub fn validate_reference(reference: &ManagedBinaryRef, workspace_id: &str) -> Result<()> {
    metadata_valid(reference.byte_length, &reference.mime_type)?;
    if reference.version != 1
        || reference.workspace_id != workspace_id
        || !canonical_uuid(&reference.workspace_id)
        || !canonical_uuid(&reference.binary_id)
        || !hash_valid(&reference.content_hash)
    {
        return Err(Error::new(
            "reference",
            "Invalid or foreign managed binary reference",
        ));
    }
    Ok(())
}
fn stage_relative(stage_id: &str) -> Result<String> {
    if !canonical_uuid(stage_id) {
        return Err(Error::new("wire", "Invalid binary stage identity"));
    }
    Ok(format!(".staging/binaries/{stage_id}.stage"))
}
fn binary_relative(binary_id: &str) -> Result<String> {
    if !canonical_uuid(binary_id) {
        return Err(Error::new("reference", "Invalid binary identity"));
    }
    // All authored owner/media/version identities stay in rows. Generated UUIDs
    // alone form paths, using the existing exact UTF-8 hex component convention.
    Ok(format!(
        "assets/id-{}",
        paths::hex_digest(binary_id.as_bytes())
    ))
}
fn ordinary(path: &Path) -> Result<Metadata> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Err(Error::new("missing", "Managed material is missing"))
        }
        Err(error) => Err(error.into()),
        Ok(_) => paths::ordinary(path, 1),
    }
}
fn optional(path: &Path) -> Result<Option<Metadata>> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => Ok(Some(metadata)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}
fn verified_file(
    location: &ManagedLocation,
    reference: &ManagedBinaryRef,
    check: &mut impl FnMut() -> Result<()>,
) -> Result<(File, FileIdentity)> {
    let path = location.resolve(false)?;
    let identity = FileIdentity::of(&ordinary(&path)?)?;
    if identity.byte_length != reference.byte_length {
        return Err(Error::new("corrupt", "Managed binary length mismatch"));
    }
    let mut file = File::open(&path)?;
    identity.check(&location.resolve(false)?, &file)?;
    verify_hash(&mut file, location, reference, &identity, check)?;
    Ok((file, identity))
}
fn verify_hash(
    file: &mut File,
    location: &ManagedLocation,
    reference: &ManagedBinaryRef,
    identity: &FileIdentity,
    check: &mut impl FnMut() -> Result<()>,
) -> Result<()> {
    check()?;
    identity.check(&location.resolve(false)?, file)?;
    file.seek(SeekFrom::Start(0))?;
    let mut hash = Sha256::new();
    let mut bytes = vec![0; CHUNK];
    let mut total = 0_u64;
    loop {
        check()?;
        identity.check(&location.resolve(false)?, file)?;
        let size = file.read(&mut bytes)?;
        identity.check(&location.resolve(false)?, file)?;
        if size == 0 {
            break;
        }
        total = total
            .checked_add(size as u64)
            .ok_or_else(|| Error::new("size", "Binary read overflow"))?;
        if total > reference.byte_length {
            return Err(Error::new("changed", "Managed binary grew during read"));
        }
        hash.update(&bytes[..size]);
        #[cfg(test)]
        {
            let mut scans = verified_scan_counts().lock().unwrap();
            *scans.entry(location.root.clone()).or_default() += size as u64;
        }
        std::thread::yield_now();
    }
    check()?;
    identity.check(&location.resolve(false)?, file)?;
    if total != reference.byte_length
        || paths::hex_digest(hash.finalize()) != reference.content_hash
    {
        return Err(Error::new("corrupt", "Managed binary checksum mismatch"));
    }
    Ok(())
}
#[cfg(test)]
fn verified_scan_counts() -> &'static std::sync::Mutex<HashMap<PathBuf, u64>> {
    static COUNTS: std::sync::OnceLock<std::sync::Mutex<HashMap<PathBuf, u64>>> =
        std::sync::OnceLock::new();
    COUNTS.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}
#[cfg(test)]
pub(crate) fn test_verified_scan_bytes(root: &Path) -> u64 {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    verified_scan_counts()
        .lock()
        .unwrap()
        .get(&root)
        .copied()
        .unwrap_or(0)
}

impl BinaryStore {
    pub fn new(root: &Path, workspace_id: &str) -> Result<Self> {
        if !canonical_uuid(workspace_id) {
            return Err(Error::new(
                "identity",
                "Invalid full-product workspace identity",
            ));
        }
        let root = paths::canonical_root(root)?;
        let (device, inode, _) = paths::inode(&fs::symlink_metadata(&root)?)?;
        Ok(Self {
            root,
            root_identity: (device, inode),
            workspace_id: workspace_id.into(),
            writes: HashMap::new(),
            reads: HashMap::new(),
        })
    }
    fn location(&self, relative: String) -> ManagedLocation {
        ManagedLocation {
            root: self.root.clone(),
            root_identity: self.root_identity,
            relative,
        }
    }
    pub fn run(&mut self, db: &Connection, request: BinaryRequest) -> Result<BinaryReply> {
        self.run_checked(db, request, &mut || Ok(()))
    }
    pub fn run_checked(
        &mut self,
        db: &Connection,
        request: BinaryRequest,
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<BinaryReply> {
        self.reap(db)?;
        check()?;
        match request {
            BinaryRequest::Prepare {
                byte_length,
                mime_type,
            } => self.prepare(db, byte_length, mime_type),
            BinaryRequest::Write {
                stage_id,
                offset,
                bytes,
            } => self.write_raw(&stage_id, offset, &bytes),
            BinaryRequest::Seal {
                stage_id,
                content_hash,
            } => self.seal(db, &stage_id, &content_hash, check),
            BinaryRequest::Abort { stage_id } => Ok(BinaryReply::Aborted {
                found: self.abort(db, &stage_id)?,
            }),
            BinaryRequest::Availability { reference } => self.availability(db, &reference, check),
            BinaryRequest::ReadStart { reference } => self.read_start(db, reference, check),
            BinaryRequest::ReadChunk {
                lease_id,
                offset,
                byte_length,
            } => self.read_chunk(&lease_id, offset, byte_length),
            BinaryRequest::ReadVerify { lease_id } => self.read_verify(&lease_id, check),
            BinaryRequest::ReadClose { lease_id } => Ok(BinaryReply::Closed {
                found: self.reads.remove(&lease_id).is_some(),
            }),
            BinaryRequest::Reap => Ok(BinaryReply::Reaped),
        }
    }
    fn prepare(
        &mut self,
        db: &Connection,
        byte_length: u64,
        mime_type: String,
    ) -> Result<BinaryReply> {
        metadata_valid(byte_length, &mime_type)?;
        if self.writes.len() >= MAX_ACTIVE_WRITES {
            return Err(Error::new("busy", "Too many managed binary writes"));
        }
        let stage_id = uuid::Uuid::new_v4().to_string();
        let binary_id = uuid::Uuid::new_v4().to_string();
        let location = self.location(stage_relative(&stage_id)?);
        let path = location.resolve(true)?;
        paths::managed(&self.root, &binary_relative(&binary_id)?, true)?;
        db.execute("INSERT INTO product_binary_intents(stage_id,binary_id,byte_length,mime_type,state) VALUES(?,?,?,?,'writing')", params![stage_id,binary_id,byte_length as i64,mime_type])?;
        // The journal exists before file creation. If provenance cannot be saved,
        // reopen refuses to erase any ambiguous bytes.
        let file = paths::exclusive(&path)?;
        file.sync_all()?;
        paths::sync_dir(path.parent().expect("stage parent"))?;
        let (device, inode, _) = paths::inode(&file.metadata()?)?;
        db.execute(
            "UPDATE product_binary_intents SET device=?,inode=? WHERE stage_id=?",
            params![device.to_string(), inode.to_string(), stage_id],
        )?;
        self.writes.insert(
            stage_id.clone(),
            WriteStage {
                file,
                path,
                location,
                binary_id: binary_id.clone(),
                byte_length,
                mime_type,
                device,
                inode,
                written: 0,
                hash: Sha256::new(),
                progressed: Instant::now(),
            },
        );
        Ok(BinaryReply::Prepared {
            stage_id,
            binary_id,
            workspace_id: self.workspace_id.clone(),
            chunk_bytes: CHUNK,
        })
    }
    pub fn write_raw(&mut self, stage_id: &str, offset: u64, bytes: &[u8]) -> Result<BinaryReply> {
        if bytes.is_empty() || bytes.len() > CHUNK {
            return Err(Error::new(
                "size",
                "Binary chunks must be nonempty and at most 256 KiB",
            ));
        }
        let stage = self
            .writes
            .get_mut(stage_id)
            .ok_or_else(|| Error::new("expired", "Binary write is closed or expired"))?;
        if stage.progressed.elapsed() >= IDLE {
            return Err(Error::new("expired", "Binary write is closed or expired"));
        }
        if offset != stage.written
            || offset
                .checked_add(bytes.len() as u64)
                .is_none_or(|end| end > stage.byte_length)
        {
            return Err(Error::new(
                "wire",
                "Binary write order or declared length mismatch",
            ));
        }
        let result = (|| {
            let current = ordinary(&stage.location.resolve(false)?)?;
            let opened = stage.file.metadata()?;
            if paths::inode(&current)? != (stage.device, stage.inode, 1)
                || paths::inode(&opened)? != (stage.device, stage.inode, 1)
                || current.len() != stage.written
                || opened.len() != stage.written
            {
                return Err(Error::new("changed", "Binary stage identity changed"));
            }
            stage.file.write_all(bytes)?;
            let after = ordinary(&stage.location.resolve(false)?)?;
            if paths::inode(&after)? != (stage.device, stage.inode, 1) {
                return Err(Error::new(
                    "changed",
                    "Binary stage identity changed during write",
                ));
            }
            stage.hash.update(bytes);
            stage.written += bytes.len() as u64;
            stage.progressed = Instant::now();
            Ok(BinaryReply::Progress {
                offset: stage.written,
            })
        })();
        if result.is_err() {
            self.writes.remove(stage_id);
        }
        result
    }

    fn seal(
        &mut self,
        db: &Connection,
        stage_id: &str,
        content_hash: &str,
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<BinaryReply> {
        if !hash_valid(content_hash) {
            return Err(Error::new("wire", "Invalid binary checksum"));
        }
        let stage = self
            .writes
            .get(stage_id)
            .ok_or_else(|| Error::new("expired", "Binary write is closed or expired"))?;
        if stage.written != stage.byte_length
            || paths::hex_digest(stage.hash.clone().finalize()) != content_hash
        {
            return Err(Error::new(
                "corrupt",
                "Incomplete or mismatched binary stage",
            ));
        }
        let result = (|| {
            stage.location.resolve(false)?;
            stage.file.sync_all()?;
            let reference = ManagedBinaryRef {
                version: 1,
                workspace_id: self.workspace_id.clone(),
                binary_id: stage.binary_id.clone(),
                byte_length: stage.byte_length,
                mime_type: stage.mime_type.clone(),
                content_hash: content_hash.into(),
            };
            verified_file(&stage.location, &reference, check)?;
            db.execute("UPDATE product_binary_intents SET content_hash=? WHERE stage_id=? AND state='writing'", params![content_hash, stage_id])?;
            let target_location = self.location(binary_relative(&stage.binary_id)?);
            let target = target_location.resolve(false)?;
            check()?;
            stage.location.resolve(false)?;
            target_location.resolve(false)?;
            fs::hard_link(&stage.path, &target)?; // atomic no-overwrite publication
            target_location.resolve(false)?;
            paths::sync_dir(target.parent().expect("binary parent"))?;
            stage.location.resolve(false)?;
            target_location.resolve(false)?;
            fs::remove_file(&stage.path)?;
            stage.location.resolve(false)?;
            paths::sync_dir(stage.path.parent().expect("stage parent"))?;
            // Record publication only after both directory durability barriers.
            // Interrupted/untrusted paths retain their durable intent for recovery.
            db.execute(
                "UPDATE product_binary_intents SET state='published' WHERE stage_id=?",
                [stage_id],
            )?;
            Ok(BinaryReply::Sealed {
                claim: BinaryClaim {
                    reference,
                    stage_id: stage_id.into(),
                },
            })
        })();
        self.writes.remove(stage_id);
        result
    }
    pub fn verify_claims(
        &self,
        db: &Connection,
        claims: &[BinaryClaim],
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<Vec<VerifiedClaim>> {
        let mut stages = HashSet::new();
        let mut binaries = HashSet::new();
        let mut verified = Vec::with_capacity(claims.len());
        for claim in claims {
            check()?;
            validate_reference(&claim.reference, &self.workspace_id)?;
            if !canonical_uuid(&claim.stage_id)
                || !stages.insert(claim.stage_id.clone())
                || !binaries.insert(claim.reference.binary_id.clone())
            {
                return Err(Error::new("wire", "Duplicate or invalid binary claims"));
            }
            validate_intent(db, claim)?;
            let location = self.location(binary_relative(&claim.reference.binary_id)?);
            let (_, identity) = verified_file(&location, &claim.reference, check)?;
            verify_provenance(db, &claim.stage_id, &identity)?;
            verified.push(VerifiedClaim {
                claim: claim.clone(),
                location,
                identity,
            });
        }
        Ok(verified)
    }
    pub fn validate_committed(&self, db: &Connection, reference: &ManagedBinaryRef) -> Result<()> {
        validate_reference(reference, &self.workspace_id)?;
        let stored = db
            .query_row(
                "SELECT byte_length,mime_type,content_hash FROM product_binaries WHERE binary_id=?",
                [&reference.binary_id],
                |row| {
                    Ok((
                        sql_length(row, 0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .optional()?;
        if stored
            != Some((
                reference.byte_length,
                reference.mime_type.clone(),
                reference.content_hash.clone(),
            ))
        {
            return Err(Error::new(
                "reference",
                "Managed binary is uncommitted or has different metadata",
            ));
        }
        Ok(())
    }
    pub fn playback(
        &self,
        db: &Connection,
        reference: &ManagedBinaryRef,
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<PlaybackFile> {
        self.validate_committed(db, reference)?;
        let location = self.location(binary_relative(&reference.binary_id)?);
        let (file, identity) = verified_file(&location, reference, check)?;
        Ok(PlaybackFile {
            location,
            retired: false,
            file,
            reference: reference.clone(),
            identity,
        })
    }
    fn availability(
        &self,
        db: &Connection,
        reference: &ManagedBinaryRef,
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<BinaryReply> {
        self.validate_committed(db, reference)?;
        let location = self.location(binary_relative(&reference.binary_id)?);
        let state = match verified_file(&location, reference, check) {
            Ok(_) => BinaryAvailability::Ready,
            Err(error) if error.code == "missing" => BinaryAvailability::Missing,
            Err(error) if matches!(error.code, "corrupt" | "changed") => {
                BinaryAvailability::Corrupt
            }
            Err(error) => return Err(error),
        };
        Ok(BinaryReply::Availability { state })
    }
    fn read_start(
        &mut self,
        db: &Connection,
        reference: ManagedBinaryRef,
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<BinaryReply> {
        self.validate_committed(db, &reference)?;
        if self.reads.len() >= MAX_ACTIVE_READS {
            return Err(Error::new("busy", "Too many active binary read leases"));
        }
        let location = self.location(binary_relative(&reference.binary_id)?);
        let (file, identity) = verified_file(&location, &reference, check)?;
        let lease_id = uuid::Uuid::new_v4().to_string();
        self.reads.insert(
            lease_id.clone(),
            ReadLease {
                file,
                location,
                reference: reference.clone(),
                identity,
                progressed: Instant::now(),
            },
        );
        Ok(BinaryReply::ReadReady {
            lease_id,
            reference,
            chunk_bytes: CHUNK,
        })
    }
    pub fn read_chunk(
        &mut self,
        lease_id: &str,
        offset: u64,
        byte_length: usize,
    ) -> Result<BinaryReply> {
        if byte_length == 0 || byte_length > CHUNK {
            return Err(Error::new("size", "Binary read chunk boundary exceeded"));
        }
        let declared = self
            .reads
            .get(lease_id)
            .ok_or_else(|| Error::new("expired", "Binary read lease is closed or expired"))?
            .reference
            .byte_length;
        if offset > declared {
            return Err(Error::new("wire", "Binary read offset exceeds bytes"));
        }
        let result = (|| {
            let lease = self
                .reads
                .get_mut(lease_id)
                .ok_or_else(|| Error::new("expired", "Binary read lease is closed or expired"))?;
            if lease.progressed.elapsed() >= IDLE {
                return Err(Error::new(
                    "expired",
                    "Binary read lease is closed or expired",
                ));
            }
            if offset > lease.reference.byte_length {
                return Err(Error::new("wire", "Binary read offset exceeds bytes"));
            }
            lease
                .identity
                .check(&lease.location.resolve(false)?, &lease.file)?;
            let size = (lease.reference.byte_length - offset).min(byte_length as u64) as usize;
            let mut bytes = vec![0; size];
            lease.file.seek(SeekFrom::Start(offset))?;
            lease.file.read_exact(&mut bytes)?;
            lease
                .identity
                .check(&lease.location.resolve(false)?, &lease.file)?;
            lease.progressed = Instant::now();
            Ok(BinaryReply::Bytes {
                bytes,
                offset,
                end: offset + size as u64 == lease.reference.byte_length,
            })
        })();
        if result.is_err() {
            self.reads.remove(lease_id);
        }
        result
    }
    fn read_verify(
        &mut self,
        lease_id: &str,
        check: &mut impl FnMut() -> Result<()>,
    ) -> Result<BinaryReply> {
        let result = (|| {
            let lease = self
                .reads
                .get_mut(lease_id)
                .ok_or_else(|| Error::new("expired", "Binary read lease is closed or expired"))?;
            verify_hash(
                &mut lease.file,
                &lease.location,
                &lease.reference,
                &lease.identity,
                check,
            )?;
            lease.progressed = Instant::now();
            Ok(BinaryReply::Verified)
        })();
        if result.is_err() {
            self.reads.remove(lease_id);
        }
        result
    }
    pub fn abort(&mut self, db: &Connection, stage_id: &str) -> Result<bool> {
        stage_relative(stage_id)?;
        self.writes.remove(stage_id);
        recover_intent(&self.root, self.root_identity, db, stage_id, false)
    }
    pub fn close(&mut self, db: &Connection) -> Result<()> {
        self.reads.clear();
        let stages: Vec<_> = self.writes.keys().cloned().collect();
        for stage_id in stages {
            self.abort(db, &stage_id)?;
        }
        Ok(())
    }
    fn reap(&mut self, db: &Connection) -> Result<()> {
        let expired: Vec<_> = self
            .writes
            .iter()
            .filter(|(_, stage)| stage.progressed.elapsed() >= IDLE)
            .map(|(id, _)| id.clone())
            .collect();
        for stage_id in expired {
            self.abort(db, &stage_id)?;
        }
        self.reads
            .retain(|_, lease| lease.progressed.elapsed() < IDLE);
        Ok(())
    }
}

fn validate_intent(db: &Connection, claim: &BinaryClaim) -> Result<()> {
    let intent = db.query_row("SELECT binary_id,byte_length,mime_type,content_hash,state FROM product_binary_intents WHERE stage_id=?", [&claim.stage_id], |row| Ok((row.get::<_,String>(0)?,sql_length(row, 1)?,row.get::<_,String>(2)?,row.get::<_,Option<String>>(3)?,row.get::<_,String>(4)?))).optional()?;
    let reference = &claim.reference;
    if intent
        != Some((
            reference.binary_id.clone(),
            reference.byte_length,
            reference.mime_type.clone(),
            Some(reference.content_hash.clone()),
            "published".into(),
        ))
    {
        return Err(Error::new(
            "reference",
            "Binary claim is not the verified published stage",
        ));
    }
    Ok(())
}
fn verify_provenance(db: &Connection, stage_id: &str, identity: &FileIdentity) -> Result<()> {
    let provenance: (Option<String>, Option<String>) = db.query_row(
        "SELECT device,inode FROM product_binary_intents WHERE stage_id=?",
        [stage_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    if provenance
        != (
            Some(identity.device.to_string()),
            Some(identity.inode.to_string()),
        )
    {
        return Err(Error::new(
            "containment",
            "Published binary identity differs from its stage",
        ));
    }
    Ok(())
}
/// Called inside the row/receipt transaction, after expensive hashing outside it.
/// Files are never removed here: SQL rollback cannot roll back an unlink.
pub fn claim_prepared(
    transaction: &Transaction<'_>,
    operation_id: &str,
    claims: &[VerifiedClaim],
) -> Result<()> {
    if !canonical_uuid(operation_id) {
        return Err(Error::new("wire", "Invalid binary operation identity"));
    }
    for verified in claims {
        validate_intent(transaction, &verified.claim)?;
        verify_provenance(transaction, &verified.claim.stage_id, &verified.identity)?;
        let path = verified.location.resolve(false)?;
        let file = File::open(&path)?;
        verified
            .identity
            .check(&verified.location.resolve(false)?, &file)?;
        let reference = &verified.claim.reference;
        transaction.execute("INSERT INTO product_binaries(binary_id,byte_length,mime_type,content_hash,operation_id,device,inode) VALUES(?,?,?,?,?,?,?)", params![reference.binary_id,reference.byte_length as i64,reference.mime_type,reference.content_hash,operation_id,verified.identity.device.to_string(),verified.identity.inode.to_string()])?;
        transaction.execute(
            "DELETE FROM product_binary_intents WHERE stage_id=?",
            [&verified.claim.stage_id],
        )?;
    }
    Ok(())
}

/// Recheck every verified file immediately before the caller's actual COMMIT,
/// after all row and receipt work. No content scan or filesystem mutation occurs.
pub fn validate_claim_files(claims: &[VerifiedClaim]) -> Result<()> {
    for verified in claims {
        let path = verified.location.resolve(false)?;
        verified
            .identity
            .check(&verified.location.resolve(false)?, &File::open(path)?)?;
    }
    Ok(())
}

pub fn recover(root: &Path, db: &Connection, workspace_id: &str) -> Result<()> {
    let authority = BinaryStore::new(root, workspace_id)?;
    // Bounded rows per page; committed blobs and unknown directory entries are
    // never scanned or erased. Startup alone never synthesizes a paid request.
    let mut after = String::new();
    loop {
        let ids = db.prepare("SELECT stage_id FROM product_binary_intents WHERE stage_id>? ORDER BY stage_id LIMIT 128")?.query_map([&after], |row| row.get::<_,String>(0))?.collect::<std::result::Result<Vec<_>,_>>()?;
        if ids.is_empty() {
            break;
        }
        for stage_id in ids {
            recover_intent(
                &authority.root,
                authority.root_identity,
                db,
                &stage_id,
                true,
            )?;
            after = stage_id;
        }
    }
    Ok(())
}
fn recover_intent(
    root: &Path,
    root_identity: (u64, u64),
    db: &Connection,
    stage_id: &str,
    retain_published: bool,
) -> Result<bool> {
    let intent = db.query_row("SELECT binary_id,state,device,inode,byte_length,mime_type,content_hash FROM product_binary_intents WHERE stage_id=?", [stage_id], |row| Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,Option<String>>(2)?,row.get::<_,Option<String>>(3)?,sql_length(row, 4)?,row.get::<_,String>(5)?,row.get::<_,Option<String>>(6)?))).optional()?;
    let Some((binary_id, state, device, inode, _, _, _)) = intent else {
        return Ok(false);
    };
    if !canonical_uuid(stage_id) || !canonical_uuid(&binary_id) {
        return Err(Error::new(
            "recovery",
            "Noncanonical binary intent; preserve bytes",
        ));
    }
    let committed: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM product_binaries WHERE binary_id=?)",
        [&binary_id],
        |row| row.get(0),
    )?;
    if committed {
        return Err(Error::new(
            "recovery",
            "Ambiguous committed binary intent; preserve bytes",
        ));
    }
    let stage_location = ManagedLocation {
        root: root.into(),
        root_identity,
        relative: stage_relative(stage_id)?,
    };
    let final_location = ManagedLocation {
        root: root.into(),
        root_identity,
        relative: binary_relative(&binary_id)?,
    };
    let stage_path = stage_location.resolve(false)?;
    let final_path = final_location.resolve(false)?;
    let stage = optional(&stage_path)?;
    let final_file = optional(&final_path)?;
    let expected_links = u64::from(stage.is_some()) + u64::from(final_file.is_some());
    if expected_links > 0 {
        let device = device
            .as_deref()
            .and_then(|v| v.parse::<u64>().ok())
            .ok_or_else(|| Error::new("recovery", "Unproven binary device; preserve bytes"))?;
        let inode = inode
            .as_deref()
            .and_then(|v| v.parse::<u64>().ok())
            .ok_or_else(|| Error::new("recovery", "Unproven binary inode; preserve bytes"))?;
        for metadata in [&stage, &final_file].into_iter().flatten() {
            if !metadata.is_file()
                || metadata.file_type().is_symlink()
                || paths::inode(metadata)? != (device, inode, expected_links)
            {
                return Err(Error::new(
                    "recovery",
                    "Binary intent identity/link ambiguity; preserve bytes",
                ));
            }
        }
    }
    // A publication after the last saved journal phase may be interrupted
    // between link/unlink/update. Preserve proven complete published bytes as an
    // unclaimed stage; no domain row is invented. Explicit abort may discard it.
    if retain_published && final_file.is_some() {
        let hash: Option<String> = db.query_row(
            "SELECT content_hash FROM product_binary_intents WHERE stage_id=?",
            [stage_id],
            |row| row.get(0),
        )?;
        if hash.as_deref().is_none_or(|value| !hash_valid(value)) {
            return Err(Error::new(
                "recovery",
                "Unverified published binary intent; preserve bytes",
            ));
        }
        if stage.is_some() {
            stage_location.resolve(false)?;
            final_location.resolve(false)?;
            fs::remove_file(&stage_path)?;
            stage_location.resolve(false)?;
            paths::sync_dir(stage_path.parent().expect("stage parent"))?;
        }
        final_location.resolve(false)?;
        paths::sync_dir(final_path.parent().expect("binary parent"))?;
        if state != "published" {
            db.execute(
                "UPDATE product_binary_intents SET state='published' WHERE stage_id=?",
                [stage_id],
            )?;
        }
        return Ok(true);
    }
    if stage.is_some() {
        stage_location.resolve(false)?;
        final_location.resolve(false)?;
        fs::remove_file(&stage_path)?;
        stage_location.resolve(false)?;
        paths::sync_dir(stage_path.parent().expect("stage parent"))?;
    }
    if final_file.is_some() {
        stage_location.resolve(false)?;
        final_location.resolve(false)?;
        fs::remove_file(&final_path)?;
        final_location.resolve(false)?;
        paths::sync_dir(final_path.parent().expect("binary parent"))?;
    }
    db.execute(
        "DELETE FROM product_binary_intents WHERE stage_id=?",
        [stage_id],
    )?;
    Ok(true)
}

#[cfg(test)]
#[path = "product_binary/tests.rs"]
mod tests;
