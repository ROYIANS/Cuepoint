use crate::{
    Asset, AssetKind, Beat, ColumnSettings, Episode, Error, Project, Result, SCHEMA, ScriptRange,
    Shot, ShotFilters, ShotSettings, State, TimingRef, VideoProject,
    contracts::{MAX_RECORDS, identity, text, timing},
    paths::{check_optional_file, derive_ref, exclusive, ordinary, validate_ref},
};
use rusqlite::{Connection, OpenFlags, params};
use std::{collections::BTreeSet, path::Path, time::Duration};

const LIST_SEPARATOR: char = '\u{001f}';
fn unpack(value: String) -> Vec<String> {
    if value.is_empty() {
        Vec::new()
    } else {
        value.split(LIST_SEPARATOR).map(str::to_owned).collect()
    }
}

const TABLES: &[(&str, &str)] = &[
    (
        "workspace",
        "CREATE TABLE workspace (id TEXT PRIMARY KEY NOT NULL, schema INTEGER NOT NULL)",
    ),
    (
        "projects",
        "CREATE TABLE projects (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL)",
    ),
    (
        "assets",
        "CREATE TABLE assets (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, kind TEXT NOT NULL, display_name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_length INTEGER NOT NULL, content_hash TEXT NOT NULL, relative_path TEXT UNIQUE NOT NULL)",
    ),
    (
        "refs",
        "CREATE TABLE refs (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, asset_id TEXT NOT NULL REFERENCES assets(id), start_sec REAL NOT NULL, duration_sec REAL NOT NULL)",
    ),
    (
        "intents",
        "CREATE TABLE intents (id TEXT PRIMARY KEY NOT NULL, asset_id TEXT UNIQUE NOT NULL, project_id TEXT NOT NULL, stage TEXT UNIQUE NOT NULL, final_path TEXT UNIQUE NOT NULL, device TEXT, inode TEXT, byte_length INTEGER, content_hash TEXT)",
    ),
    (
        "video_projects",
        "CREATE TABLE video_projects (project_id TEXT PRIMARY KEY NOT NULL, mode TEXT NOT NULL, kind TEXT NOT NULL, aspect_preset TEXT NOT NULL, output_width INTEGER NOT NULL, output_height INTEGER NOT NULL, archived_at TEXT, created_at TEXT NOT NULL, brief TEXT NOT NULL, genre TEXT NOT NULL, audience TEXT NOT NULL, tone TEXT NOT NULL, logline TEXT NOT NULL, updated_at TEXT NOT NULL, column_visible TEXT NOT NULL, shot_default_duration REAL NOT NULL, shot_auto_increment INTEGER NOT NULL, shot_workspace_view TEXT NOT NULL, shot_filter_statuses TEXT NOT NULL, shot_filter_beats TEXT NOT NULL, shot_filter_gaps TEXT NOT NULL)",
    ),
    (
        "episodes",
        "CREATE TABLE episodes (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, item_order INTEGER NOT NULL, title TEXT NOT NULL, logline TEXT NOT NULL, script TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, shot_filter_statuses TEXT NOT NULL, shot_filter_beats TEXT NOT NULL, shot_filter_gaps TEXT NOT NULL)",
    ),
    (
        "beats",
        "CREATE TABLE beats (id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL, item_order INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, time_of_day TEXT NOT NULL, script_start INTEGER, script_end INTEGER, character_ids TEXT NOT NULL, scene_id TEXT, script_excerpt TEXT NOT NULL)",
    ),
    (
        "shots",
        "CREATE TABLE shots (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, episode_id TEXT NOT NULL, item_order INTEGER NOT NULL, shot_number TEXT NOT NULL, beat_id TEXT, status TEXT NOT NULL, duration_sec REAL NOT NULL, content TEXT NOT NULL, notes TEXT NOT NULL, scene_closeup TEXT NOT NULL, sound TEXT NOT NULL, emotion TEXT NOT NULL, camera_angle TEXT NOT NULL, camera_gear TEXT NOT NULL, focal_length TEXT NOT NULL, category TEXT NOT NULL, character_ids TEXT NOT NULL, scene_id TEXT, prop_ids TEXT NOT NULL, style_id TEXT)",
    ),
    (
        "video_undo",
        "CREATE TABLE video_undo (token TEXT PRIMARY KEY NOT NULL, resource TEXT NOT NULL, ids TEXT NOT NULL, before_state TEXT NOT NULL, after_state TEXT NOT NULL)",
    ),
];

pub(crate) fn check_files(path: &Path) -> Result<()> {
    ordinary(path, 1)?;
    for suffix in ["-journal", "-wal", "-shm"] {
        check_optional_file(&path.with_file_name(format!(
            "{}{}",
            path.file_name().expect("database name").to_string_lossy(),
            suffix
        )))?;
    }
    Ok(())
}
pub(crate) fn connect(path: &Path, create: bool, readonly: bool) -> Result<Connection> {
    if create {
        exclusive(path)?.sync_all()?;
    }
    check_files(path)?;
    let flags = if readonly {
        OpenFlags::SQLITE_OPEN_READ_ONLY
    } else {
        OpenFlags::SQLITE_OPEN_READ_WRITE
    };
    let connection = Connection::open_with_flags(path, flags | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    connection.busy_timeout(Duration::from_millis(150))?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    if !readonly {
        connection.pragma_update(None, "journal_mode", "DELETE")?;
        connection.pragma_update(None, "synchronous", "FULL")?;
    }
    Ok(connection)
}
pub(crate) fn initialize(db: &Connection, id: &str) -> Result<()> {
    db.execute_batch("BEGIN IMMEDIATE")?;
    for (_, sql) in TABLES {
        db.execute_batch(sql)?;
    }
    db.execute("INSERT INTO workspace VALUES (?,?)", params![id, SCHEMA])?;
    db.pragma_update(None, "user_version", SCHEMA)?;
    db.execute_batch("COMMIT")?;
    Ok(())
}

pub(crate) fn validate(db: &Connection) -> Result<State> {
    let version: u32 = db.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version != SCHEMA {
        return Err(Error::new("schema", "Unsupported schema"));
    }
    let integrity: String = db.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if integrity != "ok" {
        return Err(Error::new("corrupt", "SQLite integrity check failed"));
    }
    let schema = db
        .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")?
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let expected: BTreeSet<_> = TABLES
        .iter()
        .map(|(name, sql)| ((*name).to_owned(), (*sql).to_owned()))
        .collect();
    if schema.into_iter().collect::<BTreeSet<_>>() != expected {
        return Err(Error::new("schema", "Unexpected native schema definition"));
    }
    let extras: i64 = db.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type IN ('trigger','view') OR (type='index' AND sql IS NOT NULL)",
        [],
        |r| r.get(0),
    )?;
    if extras != 0 {
        return Err(Error::new(
            "schema",
            "Unexpected native triggers, views or explicit indices",
        ));
    }
    let workspace_rows: i64 = db.query_row("SELECT count(*) FROM workspace", [], |r| r.get(0))?;
    if workspace_rows != 1 {
        return Err(Error::new("identity", "Ambiguous workspace identity"));
    }
    let (id, schema): (String, u32) = db.query_row("SELECT id,schema FROM workspace", [], |r| {
        Ok((r.get(0)?, r.get(1)?))
    })?;
    if schema != SCHEMA
        || uuid::Uuid::parse_str(&id).is_err()
        || uuid::Uuid::parse_str(&id)
            .map(|v| v.to_string() != id)
            .unwrap_or(true)
    {
        return Err(Error::new("identity", "Invalid portable workspace UUID"));
    }
    for table in [
        "projects",
        "assets",
        "refs",
        "intents",
        "video_projects",
        "episodes",
        "beats",
        "shots",
        "video_undo",
    ] {
        let count: i64 =
            db.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))?;
        if count > MAX_RECORDS as i64 {
            return Err(Error::new("size", "Prototype record boundary exceeded"));
        }
    }
    let projects = db
        .prepare("SELECT id,title FROM projects ORDER BY id")?
        .query_map([], |r| {
            Ok(Project {
                id: r.get(0)?,
                title: r.get(1)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for project in &projects {
        validate_project(project)?;
    }
    let rows = db.prepare("SELECT id,project_id,kind,display_name,mime_type,byte_length,content_hash,relative_path FROM assets ORDER BY id")?.query_map([], |r| Ok((r.get::<_, String>(0)?,r.get::<_, String>(1)?,r.get::<_, String>(2)?,r.get::<_, String>(3)?,r.get::<_, String>(4)?,r.get::<_, i64>(5)?,r.get::<_, String>(6)?,r.get::<_, String>(7)?)))?.collect::<std::result::Result<Vec<_>,_>>()?;
    let mut assets = Vec::new();
    for (asset_id, project_id, kind, display_name, mime_type, byte_length, content_hash, path) in
        rows
    {
        let byte_length = u64::try_from(byte_length)
            .map_err(|_| Error::new("size", "Negative SQLite asset length"))?;
        let mut reference = derive_ref(&id, &project_id, &asset_id)?;
        reference.relative_path = path;
        let kind = match kind.as_str() {
            "media" => AssetKind::Media,
            "output" => AssetKind::Output,
            _ => return Err(Error::new("schema", "Invalid asset kind")),
        };
        let asset = Asset {
            id: asset_id,
            project_id,
            kind,
            display_name,
            mime_type,
            byte_length,
            content_hash,
            reference,
        };
        validate_asset(&asset, &id)?;
        if asset.project_id != "studio" && !projects.iter().any(|p| p.id == asset.project_id) {
            return Err(Error::new("ownership", "Asset owner missing"));
        }
        assets.push(asset);
    }
    let references = db
        .prepare("SELECT id,project_id,asset_id,start_sec,duration_sec FROM refs ORDER BY id")?
        .query_map([], |r| {
            Ok(TimingRef {
                id: r.get(0)?,
                project_id: r.get(1)?,
                asset_id: r.get(2)?,
                start_sec: r.get(3)?,
                duration_sec: r.get(4)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for reference in &references {
        let asset = assets
            .iter()
            .find(|a| a.id == reference.asset_id)
            .ok_or_else(|| Error::new("ownership", "Dangling asset reference"))?;
        timing(reference, asset)?;
    }
    let foreign_errors: i64 =
        db.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
            r.get(0)
        })?;
    if foreign_errors != 0 {
        return Err(Error::new("ownership", "Foreign-key closure failed"));
    }
    let video_projects = db
        .prepare(
            "SELECT project_id,mode,kind,aspect_preset,output_width,output_height,archived_at,created_at,brief,genre,audience,tone,logline,updated_at,column_visible,shot_default_duration,shot_auto_increment,shot_workspace_view,shot_filter_statuses,shot_filter_beats,shot_filter_gaps FROM video_projects ORDER BY project_id",
        )?
        .query_map([], |r| {
            Ok(VideoProject {
                project_id: r.get(0)?,
                mode: r.get(1)?,
                kind: r.get(2)?,
                aspect_preset: r.get(3)?,
                output_width: r.get::<_, i64>(4)?.try_into().unwrap_or_default(),
                output_height: r.get::<_, i64>(5)?.try_into().unwrap_or_default(),
                archived_at: r.get(6)?,
                created_at: r.get(7)?,
                brief: r.get(8)?,
                genre: r.get(9)?,
                audience: r.get(10)?,
                tone: r.get(11)?,
                logline: r.get(12)?,
                updated_at: r.get(13)?,
                column_settings: ColumnSettings { visible: unpack(r.get(14)?) },
                shot_settings: ShotSettings {
                    default_duration_sec: r.get(15)?,
                    auto_increment_shot_number: r.get::<_, i64>(16)? != 0,
                    workspace_view: r.get(17)?,
                    filters: ShotFilters { statuses: unpack(r.get(18)?), beat_ids: unpack(r.get(19)?), gaps: unpack(r.get(20)?) },
                },
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    // A runtime snapshot may observe an owner removed by an external test hook.
    // Mutation commits and workspace reopening separately require full closure.
    for video in &video_projects {
        if projects.iter().any(|p| p.id == video.project_id) {
            validate_video_project(video, &projects)?;
        }
    }
    let episodes = db
        .prepare("SELECT id,project_id,item_order,title,logline,script,created_at,updated_at,shot_filter_statuses,shot_filter_beats,shot_filter_gaps FROM episodes ORDER BY project_id,item_order,id")?
        .query_map([], |r| Ok(Episode { id: r.get(0)?, project_id: r.get(1)?, order: r.get::<_, i64>(2)?.try_into().unwrap_or(u32::MAX), title: r.get(3)?, logline: r.get(4)?, script: r.get(5)?, created_at: r.get(6)?, updated_at: r.get(7)?, shot_filters: ShotFilters { statuses: unpack(r.get(8)?), beat_ids: unpack(r.get(9)?), gaps: unpack(r.get(10)?) } }))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let invalid_ranges: i64 = db.query_row(
        "SELECT count(*) FROM beats WHERE (script_start IS NULL) != (script_end IS NULL) OR (script_start IS NULL AND script_excerpt != '')",
        [], |row| row.get(0),
    )?;
    if invalid_ranges != 0 {
        return Err(Error::new("range", "Incomplete stored script range"));
    }
    let invalid_settings: i64 = db.query_row(
        "SELECT count(*) FROM video_projects WHERE shot_auto_increment NOT IN (0,1)",
        [],
        |row| row.get(0),
    )?;
    if invalid_settings != 0 {
        return Err(Error::new(
            "invalid",
            "Invalid stored shot numbering setting",
        ));
    }
    let beats = db
        .prepare("SELECT id,episode_id,item_order,title,content,time_of_day,script_start,script_end,character_ids,scene_id,script_excerpt FROM beats ORDER BY episode_id,item_order,id")?
        .query_map([], |r| Ok(Beat { id: r.get(0)?, episode_id: r.get(1)?, order: r.get::<_, i64>(2)?.try_into().unwrap_or(u32::MAX), title: r.get(3)?, content: r.get(4)?, time_of_day: r.get(5)?, character_ids: unpack(r.get(8)?), scene_id: r.get(9)?, script_range: match (r.get::<_, Option<i64>>(6)?, r.get::<_, Option<i64>>(7)?) { (Some(start), Some(end)) => Some(ScriptRange { start: start.try_into().unwrap_or(u32::MAX), end: end.try_into().unwrap_or(u32::MAX), excerpt: r.get(10)? }), _ => None } }))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let shots = db
        .prepare("SELECT id,project_id,episode_id,item_order,shot_number,beat_id,status,duration_sec,content,notes,scene_closeup,sound,emotion,camera_angle,camera_gear,focal_length,category,character_ids,scene_id,prop_ids,style_id FROM shots ORDER BY episode_id,item_order,id")?
        .query_map([], |r| Ok(Shot { id: r.get(0)?, project_id: r.get(1)?, episode_id: r.get(2)?, order: r.get::<_, i64>(3)?.try_into().unwrap_or(u32::MAX), shot_number: r.get(4)?, beat_id: r.get(5)?, status: r.get(6)?, duration_sec: r.get(7)?, content: r.get(8)?, notes: r.get(9)?, scene_closeup: r.get(10)?, sound: r.get(11)?, emotion: r.get(12)?, camera_angle: r.get(13)?, camera_gear: r.get(14)?, focal_length: r.get(15)?, category: r.get(16)?, character_ids: unpack(r.get(17)?), scene_id: r.get(18)?, prop_ids: unpack(r.get(19)?), style_id: r.get(20)? }))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    validate_video_rows(&projects, &video_projects, &episodes, &beats, &shots, true)?;
    let sqlite_version = db.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
    Ok(State {
        schema,
        workspace_id: id,
        projects,
        assets,
        references,
        sqlite_version,
        video_projects,
        episodes,
        beats,
        shots,
    })
}

/// Validate relationship closure before a workspace is advertised as ready
/// or reopened. Runtime snapshots remain tolerant of an external owner
/// deletion so the worker can report retained logical rows and reject the
/// next mutation without panicking.
pub(crate) fn validate_state_closure(state: &State) -> Result<()> {
    validate_video_rows(
        &state.projects,
        &state.video_projects,
        &state.episodes,
        &state.beats,
        &state.shots,
        false,
    )
}

pub(crate) fn validate_receipts(db: &Connection, workspace: &str) -> Result<()> {
    let rows = db
        .prepare("SELECT token,resource,ids,before_state,after_state FROM video_undo")?
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
            ))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    if rows.len() > 1000 {
        return Err(Error::new("size", "Undo receipt boundary"));
    }
    for (token, resource, ids, before, after) in rows {
        if uuid::Uuid::parse_str(&token).is_err()
            || resource.len() > 128
            || ids.len() > MAX_RECORDS * 720
            || before.len() > 64 * 1024 * 1024
            || after.len() > 64 * 1024 * 1024
        {
            return Err(Error::new("undo", "Invalid undo receipt metadata"));
        }
        let ids: Vec<String> = serde_json::from_str(&ids)?;
        if ids.len() > MAX_RECORDS || ids.iter().collect::<BTreeSet<_>>().len() != ids.len() {
            return Err(Error::new("undo", "Invalid receipt identities"));
        }
        for id in ids {
            identity(&id, 118)?;
        }
        for source in [before, after] {
            let state: State = serde_json::from_str(&source)?;
            if state.schema != SCHEMA || state.workspace_id != workspace {
                return Err(Error::new("undo", "Undo workspace mismatch"));
            }
            validate_state_closure(&state)?;
        }
    }
    Ok(())
}

pub(crate) fn write_video_state(db: &Connection, state: &State) -> Result<()> {
    db.execute("DELETE FROM shots", [])?;
    db.execute("DELETE FROM beats", [])?;
    db.execute("DELETE FROM episodes", [])?;
    db.execute("DELETE FROM video_projects", [])?;
    db.execute("DELETE FROM projects", [])?;
    for project in &state.projects {
        db.execute(
            "INSERT INTO projects VALUES (?,?)",
            params![project.id, project.title],
        )?;
    }
    for video in &state.video_projects {
        db.execute(
            "INSERT INTO video_projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            params![
                video.project_id,
                video.mode,
                video.kind,
                video.aspect_preset,
                video.output_width,
                video.output_height,
                video.archived_at,
                video.created_at,
                video.brief,
                video.genre,
                video.audience,
                video.tone,
                video.logline,
                video.updated_at,
                video.column_settings.visible.join("\u{1f}"),
                video.shot_settings.default_duration_sec,
                i64::from(video.shot_settings.auto_increment_shot_number),
                video.shot_settings.workspace_view,
                video.shot_settings.filters.statuses.join("\u{1f}"),
                video.shot_settings.filters.beat_ids.join("\u{1f}"),
                video.shot_settings.filters.gaps.join("\u{1f}")
            ],
        )?;
    }
    for episode in &state.episodes {
        db.execute(
            "INSERT INTO episodes VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            params![
                episode.id,
                episode.project_id,
                episode.order,
                episode.title,
                episode.logline,
                episode.script,
                episode.created_at,
                episode.updated_at,
                episode.shot_filters.statuses.join("\u{1f}"),
                episode.shot_filters.beat_ids.join("\u{1f}"),
                episode.shot_filters.gaps.join("\u{1f}")
            ],
        )?;
    }
    for beat in &state.beats {
        db.execute(
            "INSERT INTO beats VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            params![
                beat.id,
                beat.episode_id,
                beat.order,
                beat.title,
                beat.content,
                beat.time_of_day,
                beat.script_range.as_ref().map(|r| r.start),
                beat.script_range.as_ref().map(|r| r.end),
                beat.character_ids.join("\u{1f}"),
                beat.scene_id,
                beat.script_range
                    .as_ref()
                    .map(|r| r.excerpt.clone())
                    .unwrap_or_default()
            ],
        )?;
    }
    for shot in &state.shots {
        db.execute(
            "INSERT INTO shots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            params![
                shot.id,
                shot.project_id,
                shot.episode_id,
                shot.order,
                shot.shot_number,
                shot.beat_id,
                shot.status,
                shot.duration_sec,
                shot.content,
                shot.notes,
                shot.scene_closeup,
                shot.sound,
                shot.emotion,
                shot.camera_angle,
                shot.camera_gear,
                shot.focal_length,
                shot.category,
                shot.character_ids.join("\u{1f}"),
                shot.scene_id,
                shot.prop_ids.join("\u{1f}"),
                shot.style_id
            ],
        )?;
    }
    Ok(())
}

pub(crate) fn validate_project(p: &Project) -> Result<()> {
    identity(&p.id, 118)?;
    if p.id == "studio" {
        return Err(Error::new(
            "ownership",
            "Studio is a virtual owner, not a project row",
        ));
    }
    text(&p.title, "project title", 16_384)
}

pub(crate) fn validate_video_project(value: &VideoProject, projects: &[Project]) -> Result<()> {
    identity(&value.project_id, 118)?;
    if !projects.iter().any(|p| p.id == value.project_id) {
        return Err(Error::new("ownership", "Video project owner missing"));
    }
    if !matches!(value.mode.as_str(), "film" | "series") {
        return Err(Error::new("invalid", "Unsupported video project mode"));
    }
    if value.kind != "video" {
        return Err(Error::new("invalid", "Unsupported project kind"));
    }
    if !matches!(
        value.aspect_preset.as_str(),
        "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16"
    ) || value.output_width == 0
        || value.output_height == 0
        || value.output_width > 10000
        || value.output_height > 10000
    {
        return Err(Error::new("invalid", "Invalid project output settings"));
    }
    if value.archived_at.as_deref().is_some_and(|v| v.len() > 128) {
        return Err(Error::new("invalid", "Invalid archive timestamp"));
    }
    for (label, value) in [
        ("created timestamp", &value.created_at),
        ("updated timestamp", &value.updated_at),
    ] {
        text(value, label, 128)?;
    }
    for value in [&value.brief, &value.genre, &value.audience, &value.tone] {
        bounded(value, 16384)?;
    }
    let columns = [
        "category",
        "durationSec",
        "content",
        "notes",
        "sceneCloseup",
        "sound",
        "emotion",
        "cameraAngle",
        "cameraGear",
        "focalLength",
        "characters",
        "scene",
    ];
    validate_set(&value.column_settings.visible, &columns, 64)?;
    validate_filters(&value.shot_settings.filters, None)?;
    if !value.shot_settings.default_duration_sec.is_finite()
        || value.shot_settings.default_duration_sec < 0.0
        || value.shot_settings.default_duration_sec > 86_400.0
    {
        return Err(Error::new("invalid", "Invalid default shot duration"));
    }
    if !matches!(
        value.shot_settings.workspace_view.as_str(),
        "design" | "media"
    ) {
        return Err(Error::new("invalid", "Invalid shot workspace view"));
    }
    text(&value.logline, "project logline", 16_384).or_else(|_| {
        if value.logline.is_empty() {
            Ok(())
        } else {
            Err(Error::new("invalid", "Invalid project logline"))
        }
    })?;
    text(&value.updated_at, "project timestamp", 128)
}

fn bounded(value: &str, max: usize) -> Result<()> {
    if value.len() > max || value.contains('\0') {
        Err(Error::new("invalid", "Invalid bounded text"))
    } else {
        Ok(())
    }
}
fn validate_set(values: &[String], allowed: &[&str], max: usize) -> Result<()> {
    if values.len() > max
        || values.iter().collect::<BTreeSet<_>>().len() != values.len()
        || values.iter().any(|v| !allowed.contains(&v.as_str()))
    {
        return Err(Error::new("invalid", "Invalid enum set"));
    }
    Ok(())
}
fn validate_filters(value: &ShotFilters, beats: Option<&BTreeSet<&str>>) -> Result<()> {
    validate_set(
        &value.statuses,
        &["draft", "ready", "framed", "clipped", "approved"],
        5,
    )?;
    validate_set(&value.gaps, &["missingFirstFrame", "missingClip"], 2)?;
    if value.beat_ids.len() > MAX_RECORDS
        || value.beat_ids.iter().collect::<BTreeSet<_>>().len() != value.beat_ids.len()
    {
        return Err(Error::new("invalid", "Invalid beat filter set"));
    }
    for id in &value.beat_ids {
        identity(id, 118)?;
        if id.contains(LIST_SEPARATOR) {
            return Err(Error::new("invalid", "Invalid filter identity"));
        }
        if let Some(beats) = beats
            && id != "none"
            && !beats.contains(id.as_str())
        {
            return Err(Error::new(
                "ownership",
                "Filter beat does not belong to episode",
            ));
        }
    }
    Ok(())
}

pub(crate) fn valid_script_range(script: &str, range: &ScriptRange) -> bool {
    let units: Vec<u16> = script.encode_utf16().collect();
    range.end > range.start
        && units
            .get(range.start as usize..range.end as usize)
            .and_then(|slice| String::from_utf16(slice).ok())
            .as_deref()
            == Some(range.excerpt.as_str())
}

fn validate_order(items: impl Iterator<Item = u32>) -> Result<()> {
    let mut items: Vec<_> = items.collect();
    items.sort_unstable();
    for (expected, actual) in items.into_iter().enumerate() {
        if actual != expected as u32 {
            return Err(Error::new("order", "Order must be contiguous"));
        }
    }
    Ok(())
}

pub(crate) fn validate_video_rows(
    projects: &[Project],
    videos: &[VideoProject],
    episodes: &[Episode],
    beats: &[Beat],
    shots: &[Shot],
    allow_orphans: bool,
) -> Result<()> {
    if [
        projects.len(),
        videos.len(),
        episodes.len(),
        beats.len(),
        shots.len(),
    ]
    .iter()
    .any(|count| *count > MAX_RECORDS)
    {
        return Err(Error::new("size", "Native record boundary"));
    }
    for video in videos {
        if projects
            .iter()
            .any(|project| project.id == video.project_id)
        {
            validate_video_project(video, projects)?;
            let owned_episodes: BTreeSet<_> = episodes
                .iter()
                .filter(|e| e.project_id == video.project_id)
                .map(|e| e.id.as_str())
                .collect();
            let owned_beats: BTreeSet<_> = beats
                .iter()
                .filter(|b| owned_episodes.contains(b.episode_id.as_str()))
                .map(|b| b.id.as_str())
                .collect();
            validate_filters(&video.shot_settings.filters, Some(&owned_beats))?;
        } else if !allow_orphans {
            return Err(Error::new("ownership", "Video project owner missing"));
        }
    }
    let video_ids: BTreeSet<_> = videos.iter().map(|v| v.project_id.as_str()).collect();
    let project_ids: BTreeSet<_> = projects.iter().map(|p| p.id.as_str()).collect();
    for episode in episodes {
        identity(&episode.id, 118)?;
        identity(&episode.project_id, 118)?;
        if !project_ids.contains(episode.project_id.as_str()) {
            if allow_orphans {
                continue;
            }
            return Err(Error::new("ownership", "Episode project missing"));
        }
        if !video_ids.contains(episode.project_id.as_str()) {
            if allow_orphans {
                continue;
            }
            return Err(Error::new("ownership", "Episode video project missing"));
        }
        bounded(&episode.title, 16_384)?;
        if episode.logline.len() > 16_384 || episode.script.len() > 2_000_000 {
            return Err(Error::new("size", "Episode text boundary"));
        }
        text(&episode.created_at, "episode timestamp", 128)?;
        text(&episode.updated_at, "episode timestamp", 128)?;
        let owned: BTreeSet<_> = beats
            .iter()
            .filter(|b| b.episode_id == episode.id)
            .map(|b| b.id.as_str())
            .collect();
        validate_filters(&episode.shot_filters, Some(&owned))?;
    }
    for project_id in project_ids.iter().copied() {
        validate_order(
            episodes
                .iter()
                .filter(|e| e.project_id == project_id)
                .map(|e| e.order),
        )?;
    }
    let episode_ids: BTreeSet<_> = episodes.iter().map(|e| e.id.as_str()).collect();
    for beat in beats {
        identity(&beat.id, 118)?;
        let Some(episode) = episodes
            .iter()
            .find(|episode| episode.id == beat.episode_id)
        else {
            if allow_orphans {
                continue;
            }
            return Err(Error::new("ownership", "Beat episode missing"));
        };
        bounded(&beat.title, 16_384)?;
        if !beat.character_ids.is_empty() || beat.scene_id.is_some() {
            return Err(Error::new(
                "capability",
                "Native world entities are unavailable",
            ));
        }
        if beat.content.len() > 1_000_000 || beat.time_of_day.len() > 128 {
            return Err(Error::new("size", "Beat text boundary"));
        }
        if let Some(range) = &beat.script_range
            && (!valid_script_range(&episode.script, range) || range.excerpt.len() > 1_000_000)
        {
            return Err(Error::new("range", "Invalid beat script range"));
        }
    }
    for episode_id in episode_ids.iter().copied() {
        validate_order(
            beats
                .iter()
                .filter(|b| b.episode_id == episode_id)
                .map(|b| b.order),
        )?;
    }
    let beat_ids: BTreeSet<_> = beats.iter().map(|b| b.id.as_str()).collect();
    for shot in shots {
        identity(&shot.id, 118)?;
        if !shot.character_ids.is_empty()
            || shot.scene_id.is_some()
            || !shot.prop_ids.is_empty()
            || shot.style_id.is_some()
        {
            return Err(Error::new(
                "capability",
                "Native world entities are unavailable",
            ));
        }
        if !project_ids.contains(shot.project_id.as_str()) {
            if allow_orphans {
                continue;
            }
            return Err(Error::new("ownership", "Shot project missing"));
        }
        let Some(episode) = episodes
            .iter()
            .find(|episode| episode.id == shot.episode_id)
        else {
            if allow_orphans {
                continue;
            }
            return Err(Error::new("ownership", "Shot episode missing"));
        };
        if episode.project_id != shot.project_id {
            if allow_orphans {
                continue;
            }
            return Err(Error::new("ownership", "Shot project mismatch"));
        }
        if shot
            .beat_id
            .as_deref()
            .is_some_and(|id| !beat_ids.contains(id))
        {
            return Err(Error::new("ownership", "Shot beat missing"));
        }
        if let Some(id) = shot.beat_id.as_deref()
            && beats
                .iter()
                .find(|beat| beat.id == id)
                .is_some_and(|beat| beat.episode_id != shot.episode_id)
        {
            return Err(Error::new("ownership", "Shot beat episode mismatch"));
        }
        if shot.shot_number.len() > 128 {
            return Err(Error::new("invalid", "Invalid shot number"));
        }
        if !matches!(
            shot.status.as_str(),
            "draft" | "ready" | "framed" | "clipped" | "approved"
        ) || !shot.duration_sec.is_finite()
            || shot.duration_sec < 0.0
            || shot.duration_sec > 86_400.0
        {
            return Err(Error::new("invalid", "Invalid shot status or duration"));
        }
        for (name, value, max) in [
            ("shot content", &shot.content, 1_000_000),
            ("shot notes", &shot.notes, 1_000_000),
            ("shot status", &shot.status, 128),
        ] {
            if value.len() > max {
                return Err(Error::new("size", format!("Invalid {name}")));
            }
        }
        for value in [
            &shot.scene_closeup,
            &shot.sound,
            &shot.emotion,
            &shot.camera_angle,
            &shot.camera_gear,
            &shot.focal_length,
            &shot.category,
        ] {
            bounded(value, 16384)?;
        }
    }
    for episode_id in episode_ids.iter().copied() {
        validate_order(
            shots
                .iter()
                .filter(|s| s.episode_id == episode_id)
                .map(|s| s.order),
        )?;
    }
    Ok(())
}
pub(crate) fn validate_asset(a: &Asset, workspace: &str) -> Result<()> {
    identity(&a.id, 118)?;
    text(&a.display_name, "display name", 4096)?;
    text(&a.mime_type, "MIME", 256)?;
    let essence = a.mime_type.split(';').next().unwrap_or("").trim_end();
    let parts: Vec<_> = essence.split('/').collect();
    let valid_mime = parts.len() == 2
        && parts.iter().all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"_!#$&^.+-".contains(&b))
        });
    if a.mime_type.chars().any(char::is_control)
        || !valid_mime
        || a.byte_length == 0
        || a.byte_length > crate::contracts::MAX_ASSET_BYTES
        || a.content_hash.len() != 64
        || !a
            .content_hash
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(Error::new("invalid", "Invalid asset metadata"));
    }
    validate_ref(&a.reference, workspace, &a.id)?;
    if a.reference.project_id != a.project_id {
        return Err(Error::new("ownership", "Asset reference owner mismatch"));
    }
    Ok(())
}

pub(crate) fn owner(db: &Connection, project: &str) -> Result<()> {
    if project == "studio" {
        return Ok(());
    }
    let exists: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id=?)",
        [project],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(Error::new("ownership", "Project no longer exists"));
    }
    Ok(())
}

pub(crate) fn insert_asset(
    db: &Connection,
    a: &Asset,
    reference: Option<&TimingRef>,
) -> Result<()> {
    db.execute(
        "INSERT INTO assets VALUES (?,?,?,?,?,?,?,?)",
        params![
            a.id,
            a.project_id,
            match a.kind {
                AssetKind::Media => "media",
                AssetKind::Output => "output",
            },
            a.display_name,
            a.mime_type,
            i64::try_from(a.byte_length)
                .map_err(|_| Error::new("size", "SQLite byte length overflow"))?,
            a.content_hash,
            a.reference.relative_path
        ],
    )?;
    if let Some(r) = reference {
        db.execute(
            "INSERT INTO refs VALUES (?,?,?,?,?)",
            params![r.id, r.project_id, r.asset_id, r.start_sec, r.duration_sec],
        )?;
    }
    Ok(())
}
