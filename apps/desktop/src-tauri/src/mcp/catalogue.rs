use super::{McpError, Result, protocol::PrivateRef};
use crate::full_product_store::protocol::Session;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
pub(crate) type CatalogueSource = Arc<dyn Fn(&Session) -> Result<Catalogue> + Send + Sync>;
#[derive(Clone, Deserialize, Default)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Catalogue {
    pub version: u32,
    pub revision: u64,
    pub entries: Vec<Entry>,
    pub receipts: Vec<Receipt>,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Entry {
    pub server_id: String,
    pub config_revision: u64,
    pub enabled: bool,
    pub transport: String,
    pub auth: String,
    pub label: String,
    #[serde(default, deserialize_with = "present_optional")]
    pub endpoint_display: Option<String>,
    pub private_revision: PrivateRef,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Receipt {
    pub operation_id: String,
    pub fingerprint: String,
    pub kind: String,
    pub server_id: String,
    pub catalogue_revision: u64,
    pub config_revision: u64,
    #[serde(default, deserialize_with = "present_optional")]
    pub published_private_revision: Option<PrivateRef>,
    #[serde(default, deserialize_with = "present_optional")]
    pub retired_private_revision: Option<PrivateRef>,
}
fn present_optional<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> std::result::Result<Option<T>, D::Error> {
    T::deserialize(deserializer).map(Some)
}
fn reference(value: &PrivateRef) -> bool {
    value.kind == "native_vault" && id(&value.owner_id) && id(&value.revision_id)
}
pub(crate) fn id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value.as_bytes()[0].is_ascii_alphanumeric()
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
}
pub(crate) fn digest(value: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(value)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
impl Catalogue {
    pub fn parse(value: Value) -> Result<Self> {
        if value.is_null() {
            return Ok(Self {
                version: 1,
                ..Self::default()
            });
        }
        let bytes = serde_json::to_vec(&value).map_err(|_| McpError::Protocol)?;
        if bytes.len() > 2 * 1024 * 1024 {
            return Err(McpError::Limit);
        }
        let catalogue: Self = serde_json::from_value(value).map_err(|_| McpError::Protocol)?;
        if catalogue.revision > 9_007_199_254_740_990
            || catalogue.version != 1
            || catalogue.entries.len() > 16
            || catalogue.receipts.len() > 64
            || catalogue.entries.iter().any(|e| {
                !id(&e.server_id)
                    || e.config_revision == 0
                    || e.config_revision > 9_007_199_254_740_990
                    || e.label.is_empty()
                    || e.label.len() > 128
                    || e.label.chars().count() > 128
                    || e.label.chars().any(char::is_control)
                    || !matches!(e.transport.as_str(), "stdio" | "streamable_http")
                    || !matches!(e.auth.as_str(), "none" | "manual" | "oauth")
                    || e.private_revision.kind != "native_vault"
                    || !id(&e.private_revision.owner_id)
                    || !id(&e.private_revision.revision_id)
            })
        {
            return Err(McpError::Protocol);
        }
        let mut ids = std::collections::HashSet::new();
        if catalogue.entries.iter().any(|e| !ids.insert(&e.server_id)) {
            return Err(McpError::Protocol);
        }
        if catalogue.receipts.iter().any(|r| {
            !id(&r.operation_id)
                || !id(&r.server_id)
                || r.fingerprint.len() != 64
                || r.catalogue_revision > catalogue.revision
                || r.config_revision == 0
                || r.config_revision > 9_007_199_254_740_990
                || r.catalogue_revision > 9_007_199_254_740_990
                || r.published_private_revision
                    .as_ref()
                    .is_some_and(|v| !reference(v))
                || r.retired_private_revision
                    .as_ref()
                    .is_some_and(|v| !reference(v))
                || !matches!(r.kind.as_str(), "save" | "set_enabled" | "remove")
        }) {
            return Err(McpError::Protocol);
        }
        let mut receipt_ids = std::collections::HashSet::new();
        if catalogue.receipts.iter().enumerate().any(|(i, r)| {
            !receipt_ids.insert(&r.operation_id)
                || r.catalogue_revision == 0
                || !r
                    .fingerprint
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                || i > 0 && r.catalogue_revision != catalogue.receipts[i - 1].catalogue_revision + 1
        }) || if catalogue.revision == 0 {
            !catalogue.receipts.is_empty() || !catalogue.entries.is_empty()
        } else {
            catalogue.receipts.last().map(|r| r.catalogue_revision) != Some(catalogue.revision)
        } {
            return Err(McpError::Protocol);
        }
        for entry in &catalogue.entries {
            if entry.transport == "stdio" {
                if entry.auth != "none" || entry.endpoint_display.is_some() {
                    return Err(McpError::Protocol);
                }
            } else {
                let raw = entry
                    .endpoint_display
                    .as_deref()
                    .ok_or(McpError::Protocol)?;
                let u = reqwest::Url::parse(raw).map_err(|_| McpError::Protocol)?;
                let local = u
                    .host_str()
                    .is_some_and(|h| matches!(h, "localhost" | "127.0.0.1" | "[::1]"));
                if raw.len() > 512
                    || u.origin().ascii_serialization() != raw
                    || u.path() != "/"
                    || u.query().is_some()
                    || u.fragment().is_some()
                    || !u.username().is_empty()
                    || u.password().is_some()
                    || u.scheme() != "https" && !(local && u.scheme() == "http")
                {
                    return Err(McpError::Protocol);
                }
            }
        }
        Ok(catalogue)
    }
    pub fn current(&self, server: &str, revision: u64, reference: &PrivateRef) -> Result<&Entry> {
        self.entries
            .iter()
            .find(|e| {
                e.server_id == server
                    && e.config_revision == revision
                    && e.enabled
                    && &e.private_revision == reference
            })
            .ok_or(McpError::VaultConflict)
    }
}
