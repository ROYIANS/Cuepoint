//! Stable Win32 snapshots bound to real handles; initial baseline is local NTFS.
//! The Win32 calls borrow std::fs::File handles. File owns deterministic closing.
use super::NativeStat;
use crate::{Error, Result};
use std::{
    fs::{File, OpenOptions},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    path::Path,
    ptr,
};
use windows_sys::Win32::{
    Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_LIST_DIRECTORY,
        FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_TYPE_DISK,
        GetDriveTypeW, GetFileInformationByHandle, GetFileType, GetFinalPathNameByHandleW,
        GetVolumeInformationByHandleW, VOLUME_NAME_GUID,
    },
    System::{SystemServices::FILE_SUPPORTS_HARD_LINKS, WindowsProgramming::DRIVE_FIXED},
};

fn query_error(operation: &str) -> Error {
    Error::new(
        "nativeIdentity",
        format!("{operation} failed: {}", std::io::Error::last_os_error()),
    )
}
fn inspect_handle(path: &Path, share_delete: bool) -> Result<File> {
    let share =
        FILE_SHARE_READ | FILE_SHARE_WRITE | if share_delete { FILE_SHARE_DELETE } else { 0 };
    Ok(OpenOptions::new()
        .access_mode(FILE_READ_ATTRIBUTES)
        .share_mode(share)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)?)
}
fn require_local_ntfs(file: &File) -> Result<()> {
    let handle = file.as_raw_handle();
    let mut name = [0_u16; 261];
    let mut flags = 0;
    // SAFETY: borrowed live File handle; optional outputs null, sized name buffer.
    let ok = unsafe {
        GetVolumeInformationByHandleW(
            handle,
            ptr::null_mut(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
            &mut flags,
            name.as_mut_ptr(),
            name.len() as u32,
        )
    };
    if ok == 0 {
        return Err(query_error("GetVolumeInformationByHandleW"));
    }
    let end = name.iter().position(|c| *c == 0).unwrap_or(name.len());
    if String::from_utf16_lossy(&name[..end]) != "NTFS" || flags & FILE_SUPPORTS_HARD_LINKS == 0 {
        return Err(Error::new(
            "nativeFilesystem",
            "Native managed files require local NTFS with hard-link support",
        ));
    }
    // GUID paths are not available for SMB. Resolve the volume from the same
    // handle rather than from an independently canonicalized caller path.
    let mut final_path = vec![0_u16; 32768];
    // SAFETY: live borrowed handle and exact writable buffer length.
    let size = unsafe {
        GetFinalPathNameByHandleW(
            handle,
            final_path.as_mut_ptr(),
            final_path.len() as u32,
            VOLUME_NAME_GUID,
        )
    };
    if size == 0 {
        return Err(query_error("GetFinalPathNameByHandleW"));
    }
    if size as usize >= final_path.len() {
        return Err(Error::new(
            "nativeFilesystem",
            "Native volume path exceeds the supported boundary",
        ));
    }
    let path = &final_path[..size as usize];
    let prefix: Vec<_> = "\\\\?\\Volume{".encode_utf16().collect();
    if !path.starts_with(&prefix) {
        return Err(Error::new(
            "nativeFilesystem",
            "Native managed files require a local volume",
        ));
    }
    let close = path
        .iter()
        .position(|c| *c == b'}' as u16)
        .ok_or_else(|| Error::new("nativeFilesystem", "Native volume identity is malformed"))?;
    if path.get(close + 1) != Some(&(b'\\' as u16)) {
        return Err(Error::new(
            "nativeFilesystem",
            "Native volume root is malformed",
        ));
    }
    let mut volume = path[..close + 2].to_vec();
    volume.push(0);
    // SAFETY: null-terminated actual GUID volume root; no caller path authority.
    if unsafe { GetDriveTypeW(volume.as_ptr()) } != DRIVE_FIXED {
        return Err(Error::new(
            "nativeFilesystem",
            "Native managed files require a local fixed NTFS volume",
        ));
    }
    Ok(())
}
pub(super) fn stat_file(file: &File) -> Result<NativeStat> {
    let handle = file.as_raw_handle();
    // SAFETY: borrowed live File handle; no ownership transfer.
    if unsafe { GetFileType(handle) } != FILE_TYPE_DISK {
        return Err(Error::new(
            "nativeIdentity",
            "Native file identity requires a disk file handle",
        ));
    }
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: borrowed live handle and correctly sized initialized output struct.
    if unsafe { GetFileInformationByHandle(handle, &mut info) } == 0 {
        return Err(query_error("GetFileInformationByHandle"));
    }
    // Return reparse classification before requiring a volume query on a referral.
    let alias = info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0;
    if alias {
        return Err(Error::new(
            "containment",
            "Native paths must not contain reparse entries",
        ));
    }
    require_local_ntfs(file)?;
    let directory = info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY != 0;
    Ok(NativeStat {
        identity: (
            u64::from(info.dwVolumeSerialNumber),
            (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
            u64::from(info.nNumberOfLinks),
        ),
        byte_length: (u64::from(info.nFileSizeHigh) << 32) | u64::from(info.nFileSizeLow),
        modified: file.metadata()?.modified()?,
        file: !directory,
        directory,
        alias,
    })
}
pub(super) fn stat_path(path: &Path) -> Result<NativeStat> {
    stat_file(&inspect_handle(path, true)?)
}

pub(crate) struct DirectoryGuard {
    _handle: File,
}
pub(super) fn pin_directory(path: &Path) -> Result<DirectoryGuard> {
    // Attribute-only opens do not participate in the Win32 sharing checks.
    // Directory-read access makes omitted delete sharing protect the name.
    let file = OpenOptions::new()
        .access_mode(FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)?;
    let stat = stat_file(&file)?;
    if !stat.is_dir() || stat.is_alias() {
        return Err(Error::new(
            "containment",
            "A pinned native ancestor must be an ordinary directory",
        ));
    }
    Ok(DirectoryGuard { _handle: file })
}

/// This is the owner-approved Windows TEST contract, not directory fsync.
/// It validates ordinary local NTFS names for process-recovery operations.
/// Newly created/deleted namespace entries have no claimed power-loss barrier.
pub(super) fn process_namespace_checkpoint(path: &Path) -> Result<super::NamespaceCheckpoint> {
    let _guards = super::pin_ancestors(path)?;
    super::ordinary_directory(path)?;
    Ok(super::NamespaceCheckpoint::ProcessRecoveryOnly)
}
/// GENERIC_WRITE is provided by write(true); OPEN_REPARSE_POINT prevents final
/// entry referral. Snapshot checks before/after bind this borrowed file to the
/// stage's actual volume/index/link identity. Errors propagate to the caller.
pub(super) fn open_flush_file(path: &Path) -> Result<File> {
    Ok(OpenOptions::new()
        .write(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)?)
}
