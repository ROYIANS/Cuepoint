use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub const SCHEMA: u32 = 1;
pub const CHUNK: usize = 256 * 1024;
pub const MAX_RECORDS: usize = 10_000;
pub const MAX_MANIFEST_BYTES: u64 = 16 * 1024 * 1024;
pub const MAX_ASSET_BYTES: u64 = 16 * 1024 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceRef {
    pub workspace_id: String,
    pub project_id: String,
    pub relative_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Media,
    Output,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Asset {
    pub id: String,
    pub project_id: String,
    pub kind: AssetKind,
    pub display_name: String,
    pub mime_type: String,
    pub byte_length: u64,
    pub content_hash: String,
    pub reference: WorkspaceRef,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TimingRef {
    pub id: String,
    pub project_id: String,
    pub asset_id: String,
    pub start_sec: f64,
    pub duration_sec: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct State {
    pub schema: u32,
    pub workspace_id: String,
    pub projects: Vec<Project>,
    pub assets: Vec<Asset>,
    pub references: Vec<TimingRef>,
    pub sqlite_version: String,
}

/// Native caller only: paths never enter a renderer domain DTO or portable data.
#[derive(Clone, Debug)]
pub struct ImportRequest {
    pub source: PathBuf,
    pub asset_id: String,
    pub project_id: String,
    pub kind: AssetKind,
    pub display_name: String,
    pub mime_type: String,
    pub timing: Option<TimingRef>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Availability {
    Present,
    Missing,
    Corrupt,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssetAvailability {
    pub asset_id: String,
    pub status: Availability,
}

#[derive(Clone, Debug)]
pub enum Job {
    State,
    SaveProject(Project),
    Import(ImportRequest),
    Availability,
    Backup(PathBuf),
    ReadAsset { asset_id: String, max_bytes: usize },
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum Outcome {
    State(State),
    Project(Project),
    Asset(Asset),
    Availability(Vec<AssetAvailability>),
    Backup(BackupManifest),
    Bytes(Vec<u8>),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadyMarker {
    pub format: String,
    pub schema: u32,
    pub workspace_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BackupManifest {
    pub format: String,
    pub schema: u32,
    pub workspace_id: String,
    pub database_bytes: u64,
    pub database_hash: String,
    pub assets: Vec<Asset>,
}

pub(crate) fn text(value: &str, name: &str, max: usize) -> Result<()> {
    if value.trim().is_empty() || value.len() > max || value.contains('\0') {
        return Err(Error::new("invalid", format!("Invalid {name}")));
    }
    Ok(())
}
pub(crate) fn identity(value: &str, max: usize) -> Result<()> {
    // ECMAScript String.trim whitespace, matching the actual TS oracle. Rust's
    // Unicode White_Space additionally removes U+0085, which is a valid JS ID.
    let js_space = |c: char| matches!(c, '\u{0009}'..='\u{000d}' | ' ' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}');
    if value.trim_matches(js_space).is_empty() || value.len() > max {
        return Err(Error::new("identity", "Invalid exact identity"));
    }
    Ok(())
}
pub(crate) fn timing(value: &TimingRef, asset: &Asset) -> Result<()> {
    identity(&value.id, 118)?;
    if value.asset_id != asset.id
        || value.project_id != asset.project_id
        || !value.start_sec.is_finite()
        || value.start_sec < 0.0
        || !value.duration_sec.is_finite()
        || value.duration_sec <= 0.0
    {
        return Err(Error::new("ownership", "Invalid asset timing reference"));
    }
    Ok(())
}
