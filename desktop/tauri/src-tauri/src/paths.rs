use crate::{
    Error, Result, WorkspaceRef,
    contracts::{CHUNK, MAX_ASSET_BYTES, MAX_MANIFEST_BYTES, identity},
};
use sha2::{Digest, Sha256};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::{
    fs::{self, File, Metadata, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};

pub fn derive_ref(workspace: &str, project: &str, asset: &str) -> Result<WorkspaceRef> {
    if workspace.is_empty()
        || !workspace
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err(Error::new("identity", "Invalid workspace ID"));
    }
    let encode = |id: &str| -> Result<String> {
        identity(id, 4096)?;
        let mut out = String::from("id-");
        for b in id.bytes() {
            out.push_str(&format!("{b:02x}"));
        }
        Ok(out)
    };
    let owner = if project == "studio" {
        "studio".to_owned()
    } else {
        format!("projects/{}", encode(project)?)
    };
    identity(project, 4096)?;
    Ok(WorkspaceRef {
        workspace_id: workspace.into(),
        project_id: project.into(),
        relative_path: format!("{owner}/assets/{}", encode(asset)?),
    })
}

pub(crate) fn hex_digest(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn validate_ref(reference: &WorkspaceRef, workspace: &str, asset: &str) -> Result<()> {
    let expected = derive_ref(workspace, &reference.project_id, asset)?;
    if *reference != expected {
        return Err(Error::new("reference", "Noncanonical or foreign reference"));
    }
    for component in reference.relative_path.split('/') {
        if component.len() > 240 {
            return Err(Error::new(
                "length",
                "Portable path component exceeds 240 bytes",
            ));
        }
    }
    if reference.relative_path.len() > 1024 {
        return Err(Error::new("length", "Portable relative path is too long"));
    }
    Ok(())
}

pub(crate) fn inode(metadata: &Metadata) -> Result<(u64, u64, u64)> {
    #[cfg(unix)]
    {
        Ok((metadata.dev(), metadata.ino(), metadata.nlink()))
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        Err(Error::new(
            "platform",
            "Native file identity needs platform acceptance",
        ))
    }
}

pub(crate) fn ordinary(path: &Path, allowed_links: u64) -> Result<Metadata> {
    let m = fs::symlink_metadata(path)?;
    if !m.is_file() || m.file_type().is_symlink() || inode(&m)?.2 != allowed_links {
        return Err(Error::new(
            "containment",
            "Managed file must be ordinary and have only owned links",
        ));
    }
    Ok(m)
}
pub(crate) fn check_optional_file(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(_) => {
            ordinary(path, 1)?;
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn canonical_root(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() || path.components().any(|p| matches!(p, Component::ParentDir)) {
        return Err(Error::new(
            "containment",
            "Expected absolute native root without traversal",
        ));
    }
    let m = fs::symlink_metadata(path)?;
    if !m.is_dir() || m.file_type().is_symlink() {
        return Err(Error::new(
            "containment",
            "Workspace root must be a real directory",
        ));
    }
    // OS parent aliases (e.g. /var -> /private/var) are deliberately canonicalized.
    Ok(fs::canonicalize(path)?)
}

pub(crate) fn reserve(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() || path.components().any(|p| matches!(p, Component::ParentDir)) {
        return Err(Error::new("containment", "Expected an absolute fresh root"));
    }
    let parent = path
        .parent()
        .ok_or_else(|| Error::new("containment", "Missing parent"))?;
    let parent = fs::canonicalize(parent)?;
    let name = path
        .file_name()
        .ok_or_else(|| Error::new("containment", "Missing directory name"))?;
    let root = parent.join(name);
    fs::create_dir(&root)?; // Existing empty targets reject, never create_dir_all(root).
    sync_dir(&parent)?;
    Ok(root)
}

pub(crate) fn managed(root: &Path, relative: &str, create_parents: bool) -> Result<PathBuf> {
    if relative.is_empty() || relative.len() > 1024 {
        return Err(Error::new("containment", "Invalid relative path"));
    }
    canonical_root(root)?;
    let segments: Vec<_> = relative.split('/').collect();
    let mut path = root.to_path_buf();
    for (index, segment) in segments.iter().enumerate() {
        if segment.is_empty()
            || *segment == "."
            || *segment == ".."
            || segment.len() > 240
            || !segment
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
        {
            return Err(Error::new("containment", "Invalid managed path component"));
        }
        path.push(segment);
        if index + 1 == segments.len() {
            break;
        }
        if create_parents {
            match fs::create_dir(&path) {
                Ok(()) => sync_dir(path.parent().expect("managed parent"))?,
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => return Err(e.into()),
            }
        }
        let m = fs::symlink_metadata(&path)?;
        if !m.is_dir() || m.file_type().is_symlink() {
            return Err(Error::new(
                "containment",
                "Managed ancestor is not an ordinary directory",
            ));
        }
    }
    Ok(path)
}

pub(crate) fn sync_dir(path: &Path) -> Result<()> {
    File::open(path)?.sync_all()?;
    Ok(())
}
pub(crate) fn exclusive(path: &Path) -> Result<File> {
    Ok(OpenOptions::new().write(true).create_new(true).open(path)?)
}

pub(crate) fn hash_file(
    path: &Path,
    max: u64,
    mut check: impl FnMut() -> Result<()>,
) -> Result<(u64, String)> {
    let before = ordinary(path, 1)?;
    if before.len() == 0 || before.len() > max {
        return Err(Error::new("size", "File size is outside its boundary"));
    }
    let mut file = File::open(path)?;
    let opened = file.metadata()?;
    if inode(&before)? != inode(&opened)? {
        return Err(Error::new("changed", "File changed while opening"));
    }
    let mut hash = Sha256::new();
    let mut buffer = vec![0; CHUNK];
    let mut size = 0_u64;
    loop {
        check()?;
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        size += n as u64;
        if size > max {
            return Err(Error::new("size", "Observed bytes exceeded boundary"));
        }
        hash.update(&buffer[..n]);
    }
    let after = ordinary(path, 1)?;
    if size != before.len()
        || inode(&before)? != inode(&after)?
        || before.modified()? != after.modified()?
    {
        return Err(Error::new("changed", "File changed during reading"));
    }
    Ok((size, hex_digest(hash.finalize())))
}

pub(crate) fn copy_verified(
    source: &Path,
    target: &Path,
    expected_size: u64,
    expected_hash: &str,
    mut check: impl FnMut() -> Result<()>,
) -> Result<()> {
    let before = ordinary(source, 1)?;
    if expected_size == 0 || expected_size > MAX_ASSET_BYTES || before.len() != expected_size {
        return Err(Error::new("corrupt", "Source size mismatch"));
    }
    let mut input = File::open(source)?;
    if inode(&before)? != inode(&input.metadata()?)? {
        return Err(Error::new("changed", "Copy source changed while opening"));
    }
    let mut output = exclusive(target)?;
    let mut buffer = vec![0; CHUNK];
    let mut hash = Sha256::new();
    let mut size = 0_u64;
    loop {
        check()?;
        let n = input.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        size += n as u64;
        if size > expected_size {
            return Err(Error::new("changed", "Copy source grew"));
        }
        output.write_all(&buffer[..n])?;
        hash.update(&buffer[..n]);
    }
    output.sync_all()?;
    let after = ordinary(source, 1)?;
    if size != expected_size
        || hex_digest(hash.finalize()) != expected_hash
        || inode(&before)? != inode(&after)?
        || before.modified()? != after.modified()?
    {
        return Err(Error::new(
            "corrupt",
            "Copied file did not match frozen size/hash",
        ));
    }
    sync_dir(target.parent().expect("copy parent"))
}

pub(crate) fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let metadata = ordinary(path, 1)?;
    if metadata.len() == 0 || metadata.len() > MAX_MANIFEST_BYTES {
        return Err(Error::new("size", "Manifest byte boundary"));
    }
    let mut bytes = Vec::new();
    File::open(path)?
        .take(MAX_MANIFEST_BYTES + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(Error::new("size", "Manifest grew beyond boundary"));
    }
    Ok(serde_json::from_slice(&bytes)?)
}

struct ManifestWriter<'a> {
    file: &'a mut File,
    remaining: u64,
    exceeded: bool,
}
impl Write for ManifestWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if bytes.len() as u64 > self.remaining {
            self.exceeded = true;
            return Err(std::io::Error::other("Manifest exceeds byte boundary"));
        }
        let written = self.file.write(bytes)?;
        self.remaining -= written as u64;
        Ok(written)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.file.flush()
    }
}

pub(crate) fn publish_json<T: serde::Serialize>(root: &Path, name: &str, value: &T) -> Result<()> {
    let temporary = managed(root, &format!("{}.tmp", uuid::Uuid::new_v4()), false)?;
    let final_path = managed(root, name, false)?;
    let mut output = exclusive(&temporary)?;
    {
        let mut writer = ManifestWriter {
            file: &mut output,
            remaining: MAX_MANIFEST_BYTES,
            exceeded: false,
        };
        let result = serde_json::to_writer(&mut writer, value);
        if writer.exceeded {
            return Err(Error::new("size", "Manifest exceeds byte boundary"));
        }
        result?;
    }
    output.sync_all()?;
    fs::hard_link(&temporary, &final_path)?;
    sync_dir(root)?;
    fs::remove_file(&temporary)?;
    sync_dir(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completion_publication_cannot_exceed_its_reader_boundary() {
        let root =
            std::env::temp_dir().join(format!("cuepoint-manifest-review-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        // Ordinary reviewed text fields can collectively exceed the fixed reader
        // boundary even though each individual value is within its own limit.
        let payload = vec!["x".repeat(4096); 4096];
        let result = publish_json(&root, "backup.complete.json", &payload);
        let completed = root.join("backup.complete.json").exists();
        let exact = "x".repeat(MAX_MANIFEST_BYTES as usize - 2);
        publish_json(&root, "workspace.ready.json", &exact).unwrap();
        assert_eq!(
            fs::metadata(root.join("workspace.ready.json"))
                .unwrap()
                .len(),
            MAX_MANIFEST_BYTES
        );
        assert_eq!(
            read_json::<String>(&root.join("workspace.ready.json")).unwrap(),
            exact
        );
        fs::remove_dir_all(&root).unwrap();
        assert!(
            result.is_err(),
            "publisher accepted a manifest its own reader rejects"
        );
        assert!(
            !completed,
            "over-budget manifest must never become complete"
        );
    }
}
