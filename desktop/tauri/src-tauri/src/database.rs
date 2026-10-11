use crate::{
    Asset, AssetKind, Error, Project, Result, SCHEMA, State, TimingRef,
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
    for table in ["projects", "assets", "refs", "intents"] {
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
    let sqlite_version = db.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
    Ok(State {
        schema,
        workspace_id: id,
        projects,
        assets,
        references,
        sqlite_version,
    })
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
