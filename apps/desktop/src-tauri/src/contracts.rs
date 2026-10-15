use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn nullable_patch<'de, D, T>(deserializer: D) -> std::result::Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

pub const SCHEMA: u32 = 4;
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

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VideoProject {
    pub project_id: String,
    pub mode: String,
    pub kind: String,
    pub aspect_preset: String,
    pub output_width: u32,
    pub output_height: u32,
    pub archived_at: Option<String>,
    pub created_at: String,
    pub brief: String,
    pub genre: String,
    pub audience: String,
    pub tone: String,
    pub logline: String,
    pub updated_at: String,
    pub column_settings: ColumnSettings,
    pub shot_settings: ShotSettings,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShotFilters {
    pub statuses: Vec<String>,
    pub beat_ids: Vec<String>,
    pub gaps: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShotSettings {
    pub default_duration_sec: f64,
    pub auto_increment_shot_number: bool,
    pub workspace_view: String,
    pub filters: ShotFilters,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ColumnSettings {
    pub visible: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Episode {
    pub id: String,
    pub project_id: String,
    pub order: u32,
    pub title: String,
    pub logline: String,
    pub script: String,
    pub created_at: String,
    pub updated_at: String,
    pub shot_filters: ShotFilters,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Beat {
    pub id: String,
    pub episode_id: String,
    pub order: u32,
    pub title: String,
    pub content: String,
    pub time_of_day: String,
    pub character_ids: Vec<String>,
    pub scene_id: Option<String>,
    pub script_range: Option<ScriptRange>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScriptRange {
    pub start: u32,
    pub end: u32,
    pub excerpt: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Shot {
    pub id: String,
    pub project_id: String,
    pub episode_id: String,
    pub order: u32,
    pub shot_number: String,
    pub beat_id: Option<String>,
    pub status: String,
    pub duration_sec: f64,
    pub content: String,
    pub notes: String,
    pub scene_closeup: String,
    pub sound: String,
    pub emotion: String,
    pub camera_angle: String,
    pub camera_gear: String,
    pub focal_length: String,
    pub category: String,
    pub character_ids: Vec<String>,
    pub scene_id: Option<String>,
    pub prop_ids: Vec<String>,
    pub style_id: Option<String>,
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
    pub video_projects: Vec<VideoProject>,
    pub episodes: Vec<Episode>,
    pub beats: Vec<Beat>,
    pub shots: Vec<Shot>,
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
    CreateVideoProject {
        project: Project,
        video: VideoProject,
    },
    DeleteProject {
        project_id: String,
    },
    Import(ImportRequest),
    Availability,
    Backup(PathBuf),
    ReadAsset {
        asset_id: String,
        max_bytes: usize,
    },
    SaveVideoProject(VideoProject),
    PatchVideoProject {
        video: VideoProject,
        baseline: Option<Baseline>,
    },
    UpdateVideoProject {
        project_id: String,
        patch: VideoProjectPatch,
        baseline: Option<Baseline>,
    },
    DeleteEpisode {
        episode_id: String,
    },
    DuplicateBeat {
        episode_id: String,
        beat_id: String,
        include_shots: bool,
    },
    DeleteBeat {
        episode_id: String,
        beat_id: String,
    },
    DuplicateShot {
        episode_id: String,
        shot_id: String,
    },
    DeleteShots {
        episode_id: String,
        shot_ids: Vec<String>,
    },
    BulkShots {
        episode_id: String,
        shot_ids: Vec<String>,
        patch: ShotPatch,
    },
    VideoUndo {
        receipt: UndoReceipt,
    },
    VideoState(String),
    SaveEpisode(Episode),
    PatchEpisode {
        episode_id: String,
        patch: EpisodePatch,
        baseline: Option<Baseline>,
    },
    ReorderEpisodes {
        project_id: String,
        ordered_ids: Vec<String>,
    },
    SaveBeat(Beat),
    PatchBeat {
        episode_id: String,
        beat_id: String,
        patch: BeatPatch,
        baseline: Option<Baseline>,
    },
    ReorderBeats {
        episode_id: String,
        ordered_ids: Vec<String>,
    },
    SaveShot(Shot),
    AddShots {
        project_id: String,
        episode_id: String,
        count: u32,
        at_order: Option<u32>,
        beat_id: Option<String>,
    },
    PatchShot {
        shot_id: String,
        patch: ShotPatch,
        baseline: Option<Baseline>,
    },
    ReorderShots {
        episode_id: String,
        ordered_ids: Vec<String>,
    },
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
    VideoProject(VideoProject),
    Episode(Episode),
    Beat(Beat),
    Shot(Shot),
    Shots(Vec<Shot>),
    Undo(UndoReceipt),
    DuplicateBeat(DuplicateBeatResult),
    DuplicateShot(DuplicateShotResult),
    Conflict(ConflictOutcome),
    VideoState(crate::VideoWorkspaceState),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShotPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_sec: Option<f64>,
    #[serde(default, deserialize_with = "nullable_patch")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub beat_id: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, deserialize_with = "nullable_patch")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prop_ids: Option<Vec<String>>,
    #[serde(default, deserialize_with = "nullable_patch")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style_id: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scene_closeup: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sound: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_angle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera_gear: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal_length: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shot_number: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EpisodePatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shot_filters: Option<ShotFilters>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VideoProjectPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aspect_preset: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_height: Option<u32>,
    #[serde(default, deserialize_with = "nullable_patch")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brief: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column_settings: Option<ColumnSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shot_settings: Option<ShotSettings>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BeatPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_of_day: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_ids: Option<Vec<String>>,
    #[serde(default, deserialize_with = "nullable_patch")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable_patch")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script_range: Option<Option<ScriptRange>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BaselineField {
    pub field: String,
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Baseline {
    pub fields: Vec<BaselineField>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UndoReceipt {
    pub token: String,
    pub resource: String,
    pub ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DuplicateBeatResult {
    pub beat: Beat,
    pub shots: Vec<Shot>,
    pub receipt: UndoReceipt,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DuplicateShotResult {
    pub shot: Shot,
    pub receipt: UndoReceipt,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConflictField {
    pub field: String,
    pub current: String,
    pub expected: String,
    pub requested: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConflictOutcome {
    pub resource: String,
    pub id: String,
    pub fields: Vec<ConflictField>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VideoWorkspaceState {
    pub project: Project,
    pub video: VideoProject,
    pub episodes: Vec<Episode>,
    pub beats: Vec<Beat>,
    pub shots: Vec<Shot>,
    pub referenced_asset_ids: Vec<String>,
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
