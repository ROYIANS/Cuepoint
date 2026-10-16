//! One owned decoder child. Windows promises direct-child kill and wait; Unix
//! additionally owns a fresh process group. No renderer-authored command exists.
use crate::{Error, Result};
use std::{
    io::Read,
    path::Path,
    process::{Child, Command, Stdio},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::{Duration, Instant},
};

const PNG_LIMIT: usize = 8 * 1024 * 1024;
const LOG_LIMIT: usize = 64 * 1024;
const DEADLINE: Duration = Duration::from_secs(120);

struct OwnedChild {
    child: Child,
    settled: bool,
}
impl OwnedChild {
    fn terminate(&mut self) {
        #[cfg(unix)]
        {
            // process_group(0) below makes this child's PID its private PGID.
            unsafe extern "C" {
                fn kill(pid: i32, signal: i32) -> i32;
            }
            let _ = unsafe { kill(-(self.child.id() as i32), 9) };
        }
        let _ = self.child.kill();
    }
}
impl Drop for OwnedChild {
    fn drop(&mut self) {
        if !self.settled {
            self.terminate();
            let _ = self.child.wait();
        }
    }
}

fn drain(mut input: impl Read, limit: usize, overflow: Arc<AtomicBool>) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = input.read(&mut buffer)?;
        if read == 0 {
            return Ok(bytes);
        }
        let remaining = limit.saturating_sub(bytes.len());
        bytes.extend_from_slice(&buffer[..read.min(remaining)]);
        if read > remaining {
            overflow.store(true, Ordering::SeqCst);
        }
        // Keep draining until the owner kills and reaps an over-budget child.
    }
}

fn run(command: Command, cancel: &AtomicBool, deadline: Duration) -> Result<Vec<u8>> {
    run_with_wait(command, cancel, deadline, Child::wait)
}

#[cfg(all(test, unix))]
pub(crate) fn wait_failure_fixture(cancel: &AtomicBool) -> Result<Vec<u8>> {
    let mut command = Command::new("/bin/sleep");
    command.arg("30");
    run_with_wait(command, cancel, Duration::from_millis(30), |_| {
        Err(std::io::Error::other("Injected lost exit acknowledgement"))
    })
}
fn run_with_wait(
    mut command: Command,
    cancel: &AtomicBool,
    deadline: Duration,
    mut wait: impl FnMut(&mut Child) -> std::io::Result<std::process::ExitStatus>,
) -> Result<Vec<u8>> {
    if cancel.load(Ordering::SeqCst) {
        return Err(Error::new("canceled", "Media operation stopped"));
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = OwnedChild {
        child: command
            .spawn()
            .map_err(|_| Error::new("decoderUnavailable", "Media decoder could not start"))?,
        settled: false,
    };
    let overflow = Arc::new(AtomicBool::new(false));
    let stdout = child
        .child
        .stdout
        .take()
        .ok_or_else(|| Error::new("decoder", "Missing decoder output"))?;
    let stderr = child
        .child
        .stderr
        .take()
        .ok_or_else(|| Error::new("decoder", "Missing decoder diagnostics"))?;
    let out_flag = Arc::clone(&overflow);
    let out = thread::spawn(move || drain(stdout, PNG_LIMIT, out_flag));
    let err_flag = Arc::clone(&overflow);
    let err = thread::spawn(move || drain(stderr, LOG_LIMIT, err_flag));
    let started = Instant::now();
    let result = loop {
        if cancel.load(Ordering::SeqCst) {
            break Err(Error::new("canceled", "Media operation stopped"));
        }
        if overflow.load(Ordering::SeqCst) {
            break Err(Error::new(
                "decoderLimit",
                "Media decoder output exceeded its limit",
            ));
        }
        if started.elapsed() >= deadline {
            break Err(Error::new("decoderTimeout", "Media decoder timed out"));
        }
        match child.child.try_wait() {
            Ok(Some(status)) => {
                break if status.success() {
                    Ok(())
                } else {
                    Err(Error::new("decoder", "Video could not be decoded"))
                };
            }
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(_) => break Err(Error::new("decoder", "Media decoder status unavailable")),
        }
    };
    // Kill even after a successful direct-child exit so Unix descendants cannot
    // retain pipes. The pinned Windows decoder is a single-child contract.
    child.terminate();
    let waited = wait(&mut child.child);
    if waited.is_err() {
        // Keep ownership when an OS wait cannot confirm exit. The caller retains
        // its private input; no stopped acknowledgement or cleanup is permitted.
        thread::spawn(move || {
            loop {
                child.terminate();
                if child.child.wait().is_ok() {
                    child.settled = true;
                    break;
                }
                thread::sleep(Duration::from_millis(50));
            }
            let _ = out.join();
            let _ = err.join();
            drop(child);
        });
        return Err(Error::new(
            "decoderStopUnknown",
            "Decoder exit was not confirmed",
        ));
    }
    child.settled = true;
    let bytes = out
        .join()
        .map_err(|_| Error::new("decoder", "Decoder output reader interrupted"))?;
    let diagnostics = err
        .join()
        .map_err(|_| Error::new("decoder", "Decoder diagnostic reader interrupted"))?;
    waited.map_err(|_| Error::new("decoderStopUnknown", "Decoder exit was not confirmed"))?;
    result?;
    diagnostics?;
    if overflow.load(Ordering::SeqCst) {
        return Err(Error::new(
            "decoderLimit",
            "Media decoder output exceeded its limit",
        ));
    }
    bytes
}

pub(crate) fn thumbnail(
    executable: &Path,
    input: &Path,
    directory: &Path,
    cancel: &AtomicBool,
) -> Result<Vec<u8>> {
    let mut command = Command::new(executable);
    // MOV/MP4, Matroska/WebM and AVI only. No playlist/concat/network input.
    command
        .current_dir(directory)
        .args([
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            "mov,matroska,webm,avi",
            "-threads",
            "1",
            "-i",
        ])
        .arg(input)
        .args([
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-an",
            "-sn",
            "-dn",
            "-vf",
            "scale=640:640:force_original_aspect_ratio=decrease",
            "-threads",
            "1",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
        ]);
    run(command, cancel, DEADLINE)
}

pub(crate) fn png_dimensions(bytes: &[u8]) -> Result<(u32, u32)> {
    if bytes.len() < 45
        || bytes.len() > PNG_LIMIT
        || &bytes[..8] != b"\x89PNG\r\n\x1a\n"
        || bytes[8..12] != 13_u32.to_be_bytes()
        || &bytes[12..16] != b"IHDR"
        || &bytes[bytes.len() - 8..bytes.len() - 4] != b"IEND"
    {
        return Err(Error::new(
            "decoderOutput",
            "Decoder did not produce a complete PNG",
        ));
    }
    let mut offset = 8_usize;
    let mut image_data = false;
    let mut end = false;
    while offset < bytes.len() {
        let header = bytes
            .get(offset..offset + 8)
            .ok_or_else(|| Error::new("decoderOutput", "Truncated PNG chunk"))?;
        let size = u32::from_be_bytes(header[..4].try_into().expect("PNG length")) as usize;
        let next = offset
            .checked_add(12)
            .and_then(|n| n.checked_add(size))
            .filter(|n| *n <= bytes.len())
            .ok_or_else(|| Error::new("decoderOutput", "PNG chunk exceeded its boundary"))?;
        let mut crc = 0xffff_ffff_u32;
        for byte in &bytes[offset + 4..next - 4] {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                crc = (crc >> 1) ^ (0xedb8_8320_u32 & (0_u32.wrapping_sub(crc & 1)));
            }
        }
        let expected = u32::from_be_bytes(bytes[next - 4..next].try_into().expect("PNG CRC"));
        if !crc != expected {
            return Err(Error::new("decoderOutput", "PNG chunk checksum failed"));
        }
        match &header[4..8] {
            b"IHDR" if offset != 8 || size != 13 => {
                return Err(Error::new("decoderOutput", "Invalid PNG header"));
            }
            b"IDAT" => image_data = true,
            b"IEND" => {
                if size != 0 || next != bytes.len() {
                    return Err(Error::new("decoderOutput", "Invalid PNG ending"));
                }
                end = true;
            }
            _ => {}
        }
        offset = next;
    }
    if !image_data || !end {
        return Err(Error::new("decoderOutput", "Incomplete PNG image data"));
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into().expect("PNG width"));
    let height = u32::from_be_bytes(bytes[20..24].try_into().expect("PNG height"));
    if width == 0 || height == 0 || width > 640 || height > 640 {
        return Err(Error::new(
            "decoderOutput",
            "Thumbnail dimensions exceeded their limit",
        ));
    }
    Ok((width, height))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn cancellation_kills_and_reaps_actual_child() {
        let cancel = Arc::new(AtomicBool::new(false));
        let signal = Arc::clone(&cancel);
        let stop = thread::spawn(move || {
            thread::sleep(Duration::from_millis(80));
            signal.store(true, Ordering::SeqCst);
        });
        let mut command = Command::new("/bin/sleep");
        command.arg("30");
        let started = Instant::now();
        assert_eq!(
            run(command, &cancel, Duration::from_secs(10))
                .unwrap_err()
                .code,
            "canceled"
        );
        assert!(started.elapsed() < Duration::from_secs(2));
        stop.join().unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn deadline_kills_and_reaps_actual_child() {
        let mut command = Command::new("/bin/sleep");
        command.arg("30");
        assert_eq!(
            run(command, &AtomicBool::new(false), Duration::from_millis(30))
                .unwrap_err()
                .code,
            "decoderTimeout"
        );
    }
    #[cfg(unix)]
    #[test]
    fn failed_wait_remains_unknown_and_background_owner_reaps_actual_child() {
        let mut command = Command::new("/bin/sleep");
        command.arg("30");
        let mut child_id = 0;
        let result = run_with_wait(
            command,
            &AtomicBool::new(false),
            Duration::from_millis(30),
            |child| {
                child_id = child.id();
                Err(std::io::Error::other(
                    "Injected exit acknowledgement failure",
                ))
            },
        );
        assert_eq!(result.unwrap_err().code, "decoderStopUnknown");
        assert_ne!(child_id, 0);
        unsafe extern "C" {
            fn kill(pid: i32, signal: i32) -> i32;
        }
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            if unsafe { kill(child_id as i32, 0) } == -1 {
                assert_eq!(std::io::Error::last_os_error().raw_os_error(), Some(3));
                break;
            }
            assert!(
                Instant::now() < deadline,
                "Background owner failed to reap its decoder"
            );
            thread::sleep(Duration::from_millis(10));
        }
    }
    #[test]
    fn malformed_and_oversized_png_reject() {
        assert!(png_dimensions(b"not a PNG").is_err());
        let mut png = vec![0; 45];
        png[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        png[8..12].copy_from_slice(&13_u32.to_be_bytes());
        png[12..16].copy_from_slice(b"IHDR");
        png[16..20].copy_from_slice(&641_u32.to_be_bytes());
        png[20..24].copy_from_slice(&1_u32.to_be_bytes());
        png[37..41].copy_from_slice(b"IEND");
        assert!(png_dimensions(&png).is_err());
    }
}
