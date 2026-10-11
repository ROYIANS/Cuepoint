use crate::{
    Asset, AssetKind, Beat, Episode, Error, Project, Result, SCHEMA, Shot, State, TimingRef,
    VideoProject,
    contracts::{MAX_RECORDS, identity, text, timing},
    paths::{check_optional_file, derive_ref, exclusive, ordinary, validate_ref},
};
use rusqlite::{Connection, OpenFlags, params};
use std::{collections::BTreeSet, path::Path, time::Duration};

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
        "CREATE TABLE video_projects (project_id TEXT PRIMARY KEY NOT NULL, mode TEXT NOT NULL, logline TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    (
        "episodes",
        "CREATE TABLE episodes (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, item_order INTEGER NOT NULL, title TEXT NOT NULL, logline TEXT NOT NULL, script TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    (
        "beats",
        "CREATE TABLE beats (id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL, item_order INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, time_of_day TEXT NOT NULL, script_start INTEGER, script_end INTEGER)",
    ),
    (
        "shots",
        "CREATE TABLE shots (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, episode_id TEXT NOT NULL, item_order INTEGER NOT NULL, shot_number INTEGER NOT NULL, beat_id TEXT, status TEXT NOT NULL, duration_sec REAL NOT NULL, content TEXT NOT NULL, notes TEXT NOT NULL, scene_closeup TEXT NOT NULL, sound TEXT NOT NULL, emotion TEXT NOT NULL, camera_angle TEXT NOT NULL, camera_gear TEXT NOT NULL, focal_length TEXT NOT NULL)",
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
            "SELECT project_id,mode,logline,updated_at FROM video_projects ORDER BY project_id",
        )?
        .query_map([], |r| {
            Ok(VideoProject {
                project_id: r.get(0)?,
                mode: r.get(1)?,
                logline: r.get(2)?,
                updated_at: r.get(3)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    // Keep the base project's historical rows readable when a test hook (or
    // an interrupted external edit) removes the project row.  Child video
    // records below still require a live project and video owner, and writes
    // validate their owner before insertion.
    for video in &video_projects {
        if projects.iter().any(|p| p.id == video.project_id) {
            validate_video_project(video, &projects)?;
        }
    }
    let episodes = db
        .prepare("SELECT id,project_id,item_order,title,logline,script,created_at,updated_at FROM episodes ORDER BY project_id,item_order,id")?
        .query_map([], |r| Ok(Episode { id: r.get(0)?, project_id: r.get(1)?, order: r.get::<_, i64>(2)?.try_into().unwrap_or(u32::MAX), title: r.get(3)?, logline: r.get(4)?, script: r.get(5)?, created_at: r.get(6)?, updated_at: r.get(7)? }))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let beats = db
        .prepare("SELECT id,episode_id,item_order,title,content,time_of_day,script_start,script_end FROM beats ORDER BY episode_id,item_order,id")?
        .query_map([], |r| Ok(Beat { id: r.get(0)?, episode_id: r.get(1)?, order: r.get::<_, i64>(2)?.try_into().unwrap_or(u32::MAX), title: r.get(3)?, content: r.get(4)?, time_of_day: r.get(5)?, script_start: r.get::<_, Option<i64>>(6)?.map(|v| v.try_into().unwrap_or(u32::MAX)), script_end: r.get::<_, Option<i64>>(7)?.map(|v| v.try_into().unwrap_or(u32::MAX)) }))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let shots = db
        .prepare("SELECT id,project_id,episode_id,item_order,shot_number,beat_id,status,duration_sec,content,notes,scene_closeup,sound,emotion,camera_angle,camera_gear,focal_length FROM shots ORDER BY episode_id,item_order,id")?
        .query_map([], |r| Ok(Shot { id: r.get(0)?, project_id: r.get(1)?, episode_id: r.get(2)?, order: r.get::<_, i64>(3)?.try_into().unwrap_or(u32::MAX), shot_number: r.get::<_, i64>(4)?.try_into().unwrap_or(u32::MAX), beat_id: r.get(5)?, status: r.get(6)?, duration_sec: r.get(7)?, content: r.get(8)?, notes: r.get(9)?, scene_closeup: r.get(10)?, sound: r.get(11)?, emotion: r.get(12)?, camera_angle: r.get(13)?, camera_gear: r.get(14)?, focal_length: r.get(15)? }))?
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
    text(&value.logline, "project logline", 16_384).or_else(|_| {
        if value.logline.is_empty() {
            Ok(())
        } else {
            Err(Error::new("invalid", "Invalid project logline"))
        }
    })?;
    text(&value.updated_at, "project timestamp", 128)
}

fn validate_order(items: impl Iterator<Item = u32>) -> Result<()> {
    for (expected, actual) in items.enumerate() {
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
    for video in videos {
        if projects
            .iter()
            .any(|project| project.id == video.project_id)
        {
            validate_video_project(video, projects)?;
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
        text(&episode.title, "episode title", 16_384)?;
        if episode.logline.len() > 16_384 || episode.script.len() > 2_000_000 {
            return Err(Error::new("size", "Episode text boundary"));
        }
        text(&episode.created_at, "episode timestamp", 128)?;
        text(&episode.updated_at, "episode timestamp", 128)?;
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
        text(&beat.title, "beat title", 16_384)?;
        if beat.content.len() > 1_000_000 || beat.time_of_day.len() > 128 {
            return Err(Error::new("size", "Beat text boundary"));
        }
        match (beat.script_start, beat.script_end) {
            (None, None) => {}
            (Some(start), Some(end)) if end >= start => {
                let script_length = episode.script.encode_utf16().count() as u32;
                if end > script_length {
                    return Err(Error::new(
                        "range",
                        "Beat script range exceeds episode script",
                    ));
                }
            }
            _ => return Err(Error::new("range", "Invalid beat script range")),
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
