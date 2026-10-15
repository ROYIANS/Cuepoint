//! Opaque, revocable playback authority. Idle cards own metadata, never files.
use crate::{
    Error, Result,
    full_product_store::protocol::Session,
    product_binary::{PlaybackAuthority, PlaybackFile},
};
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

mod server;
pub use server::MediaServer;

pub type ValidateSession = Arc<dyn Fn(&Session) -> Result<()> + Send + Sync>;
struct Lease {
    session: Session,
    authority: PlaybackAuthority,
    active: AtomicBool,
}
#[derive(Default)]
pub struct MediaPreviews {
    leases: Mutex<HashMap<String, Arc<Lease>>>,
}
impl MediaPreviews {
    /// The already hash-verified initial descriptor is deliberately dropped.
    /// The capability survives while no request is open, including >64 cards.
    pub fn insert(&self, session: Session, file: PlaybackFile) -> Result<String> {
        let reference = file.reference().clone();
        if !reference.mime_type.starts_with("audio/") && !reference.mime_type.starts_with("video/")
        {
            return Err(Error::new("invalid", "Preview requires audio or video"));
        }
        let id = uuid::Uuid::new_v4().to_string();
        self.leases
            .lock()
            .map_err(|_| Error::new("worker", "Preview lifecycle poisoned"))?
            .insert(
                id.clone(),
                Arc::new(Lease {
                    session,
                    authority: file.into_authority(),
                    active: AtomicBool::new(true),
                }),
            );
        Ok(id)
    }
    pub fn release(&self, session: &Session, id: &str) -> Result<bool> {
        canonical_id(id)?;
        let mut leases = self
            .leases
            .lock()
            .map_err(|_| Error::new("worker", "Preview lifecycle poisoned"))?;
        if let Some(lease) = leases.get(id) {
            if lease.session.version != session.version
                || lease.session.session != session.session
                || lease.session.workspace_id != session.workspace_id
                || lease.session.generation != session.generation
            {
                return Err(Error::new("closed", "Preview belongs to another session"));
            }
            lease.active.store(false, Ordering::SeqCst);
        }
        Ok(leases.remove(id).is_some())
    }
    pub fn clear(&self) {
        if let Ok(mut leases) = self.leases.lock() {
            for lease in leases.values() {
                lease.active.store(false, Ordering::SeqCst);
            }
            leases.clear();
        }
    }
    fn open(&self, id: &str, validate: &ValidateSession) -> Result<MediaRead> {
        canonical_id(id)?;
        let lease = self
            .leases
            .lock()
            .map_err(|_| Error::new("worker", "Preview lifecycle poisoned"))?
            .get(id)
            .cloned()
            .ok_or_else(|| Error::new("closed", "Media preview is closed"))?;
        validate(&lease.session)?;
        if !lease.active.load(Ordering::SeqCst) {
            return Err(Error::new("closed", "Preview revoked"));
        }
        let file = match lease.authority.open_checked() {
            Ok(file) => file,
            Err(error) => {
                lease.active.store(false, Ordering::SeqCst);
                return Err(error);
            }
        };
        validate(&lease.session)?;
        if !lease.active.load(Ordering::SeqCst) {
            return Err(Error::new("closed", "Preview revoked"));
        }
        Ok(MediaRead { lease, file })
    }
}
struct MediaRead {
    lease: Arc<Lease>,
    file: PlaybackFile,
}
impl MediaRead {
    fn read(&mut self, offset: u64, bytes: usize, validate: &ValidateSession) -> Result<Vec<u8>> {
        validate(&self.lease.session)?;
        if !self.lease.active.load(Ordering::SeqCst) {
            return Err(Error::new("closed", "Preview revoked"));
        }
        let result = match self.file.read_chunk(offset, bytes) {
            Ok(bytes) => bytes,
            Err(error) => {
                self.lease.active.store(false, Ordering::SeqCst);
                return Err(error);
            }
        };
        validate(&self.lease.session)?;
        if !self.lease.active.load(Ordering::SeqCst) {
            return Err(Error::new("closed", "Preview revoked"));
        }
        Ok(result)
    }
}
fn canonical_id(id: &str) -> Result<()> {
    if uuid::Uuid::parse_str(id).is_ok_and(|uuid| uuid.to_string() == id) {
        Ok(())
    } else {
        Err(Error::new("invalid", "Invalid media capability"))
    }
}
#[derive(Debug, PartialEq)]
struct SelectedRange {
    start: u64,
    end: u64,
    partial: bool,
}
fn select_range(range: Option<&str>, length: u64) -> Result<SelectedRange> {
    let invalid = || Error::new("range", "Media range is not satisfiable");
    let number = |s: &str| -> Result<u64> {
        if s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()) {
            return Err(invalid());
        }
        s.parse().map_err(|_| invalid())
    };
    let Some(s) = range else {
        return Ok(SelectedRange {
            start: 0,
            end: length,
            partial: false,
        });
    };
    // RFC 9110 §14.2 requires ignoring a range unit we do not understand.
    if !s.starts_with("bytes=") {
        return Ok(SelectedRange {
            start: 0,
            end: length,
            partial: false,
        });
    }
    if s.len() > 128 || length == 0 {
        return Err(invalid());
    }
    let (a, b) = s
        .strip_prefix("bytes=")
        .ok_or_else(invalid)?
        .split_once('-')
        .ok_or_else(invalid)?;
    let (start, end) = if a.is_empty() {
        let suffix = number(b)?;
        if suffix == 0 {
            return Err(invalid());
        }
        (length.saturating_sub(suffix), length)
    } else {
        let start = number(a)?;
        if start >= length {
            return Err(invalid());
        }
        let end = if b.is_empty() {
            length
        } else {
            number(b)?.saturating_add(1).min(length)
        };
        if end <= start {
            return Err(invalid());
        }
        (start, end)
    };
    // The response describes the complete selected range. Only each disk/socket
    // turn is chunked; the representation is never silently truncated.
    Ok(SelectedRange {
        start,
        end,
        partial: true,
    })
}

#[cfg(test)]
mod tests;
