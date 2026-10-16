use super::{McpError, Result};
use std::{
    io,
    pin::Pin,
    task::{Context, Poll},
};
use tokio::io::{AsyncRead, ReadBuf};

/// Enforce the line bound before rmcp's AsyncRwTransport can grow its line buffer.
/// Reading this wrapper never returns a prefix of an over-budget chunk to the SDK.
pub(crate) struct BoundedLines<R> {
    inner: R,
    line_bytes: usize,
    limit: usize,
    failed: bool,
}
impl<R> BoundedLines<R> {
    pub(crate) fn new(inner: R, limit: usize) -> Self {
        Self {
            inner,
            line_bytes: 0,
            limit,
            failed: false,
        }
    }
}
impl<R: AsyncRead + Unpin> AsyncRead for BoundedLines<R> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        out: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        if self.failed {
            return Poll::Ready(Err(io::Error::other("MCP framing limit")));
        }
        let mut scratch = [0u8; 8192];
        let n = out.remaining().min(scratch.len());
        let mut buf = ReadBuf::new(&mut scratch[..n]);
        match Pin::new(&mut self.inner).poll_read(cx, &mut buf) {
            Poll::Ready(Ok(())) => {
                for byte in buf.filled() {
                    if *byte == b'\n' {
                        self.line_bytes = 0;
                    } else {
                        self.line_bytes += 1;
                        if self.line_bytes > self.limit {
                            self.failed = true;
                            return Poll::Ready(Err(io::Error::other("MCP framing limit")));
                        }
                    }
                }
                out.put_slice(buf.filled());
                Poll::Ready(Ok(()))
            }
            other => other,
        }
    }
}

pub(crate) async fn body(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>> {
    if response.content_length().is_some_and(|n| n > limit as u64) {
        return Err(McpError::Limit);
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| McpError::Transport)? {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(McpError::Limit);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;
    #[tokio::test]
    async fn mcp_line_cap_precedes_sdk_allocation_and_survives_partial_reads() {
        let mut bounded = BoundedLines::new(&b"1234\n12\n"[..], 4);
        let mut bytes = Vec::new();
        bounded.read_to_end(&mut bytes).await.unwrap();
        assert_eq!(bytes, b"1234\n12\n");
        let mut bounded = BoundedLines::new(&b"12345"[..], 4);
        assert!(bounded.read_to_end(&mut Vec::new()).await.is_err());
    }
}
