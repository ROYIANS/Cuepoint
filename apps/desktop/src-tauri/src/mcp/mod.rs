//! Finite desktop MCP owner, bounded SDK transports and native credential storage.
//! All errors are closed codes: SDK payloads, tokens and stderr are never diagnostics.
pub(crate) mod bounded;
pub(crate) mod catalogue;
pub(crate) mod oauth;
pub(crate) mod process;
pub(crate) mod protocol;
pub(crate) mod service;
pub(crate) mod transport;
pub(crate) mod vault;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum McpError {
    Limit,
    AuthRequired,
    Deadline,
    Transport,
    Endpoint,
    Protocol,
    VaultUnavailable,
    VaultUnknown,
    VaultConflict,
    VaultCorrupt,
    DrainUnknown,
}
impl std::fmt::Display for McpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "MCP {self:?}")
    }
}
impl std::error::Error for McpError {}
pub(crate) type Result<T> = std::result::Result<T, McpError>;
pub(crate) const MESSAGE_BYTES: usize = 1024 * 1024;
pub(crate) const REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

#[cfg(test)]
mod tests;

#[cfg(test)]
mod oauth_tests;

#[cfg(test)]
mod service_tests;
