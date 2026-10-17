//! Released hashes bootstrap old workspaces; persisted snapshots describe subsequent upgrades.
use super::{REGISTRY_SCHEMA, digest, registry, validate_open_for_registry};
use crate::{Error, Hooks, Result};
use rusqlite::{Connection, params};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};

pub(super) const CATALOG_JSON: &str = include_str!("registry-history/catalog.json");
include!(concat!(env!("OUT_DIR"), "/registry_history.rs"));

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Catalog {
    format: u32,
    registries: Vec<ReleasedRegistry>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReleasedRegistry {
    file: String,
    sha256: String,
    releases: Vec<String>,
}
fn invalid(message: &str) -> Error {
    Error::new("schema", message)
}
fn additions(source: &registry::Registry, current: &registry::Registry) -> Result<Vec<String>> {
    if source.version != current.version
        || source
            .tables
            .iter()
            .any(|(name, definition)| current.tables.get(name) != Some(definition))
    {
        return Err(invalid("Product registry table definition is incompatible"));
    }
    Ok(current
        .tables
        .keys()
        .filter(|name| !source.tables.contains_key(*name))
        .cloned()
        .collect())
}

pub(super) fn validate_catalog(
    catalog_json: &str,
    current_json: &str,
    snapshots: &[(&str, &str)],
) -> Result<Catalog> {
    let catalog: Catalog = serde_json::from_str(catalog_json)?;
    let current = registry::parse(current_json)?;
    if catalog.format != 1 || catalog.registries.is_empty() {
        return Err(invalid("Unsupported or empty registry catalog"));
    }
    let bundled: BTreeMap<&str, &str> = snapshots.iter().copied().collect();
    let files: BTreeSet<&str> = catalog
        .registries
        .iter()
        .map(|entry| entry.file.as_str())
        .collect();
    if bundled.len() != snapshots.len()
        || files.len() != catalog.registries.len()
        || files != bundled.keys().copied().collect()
    {
        return Err(invalid("Registry catalog and bundled snapshots differ"));
    }
    let mut hashes = BTreeSet::new();
    let mut releases = BTreeSet::new();
    for entry in &catalog.registries {
        let raw = bundled[entry.file.as_str()];
        if entry.sha256 != digest(raw.as_bytes()) || !hashes.insert(entry.sha256.as_str()) {
            return Err(invalid("Released registry snapshot hash mismatch"));
        }
        if entry.releases.is_empty()
            || entry
                .releases
                .iter()
                .any(|release| release.is_empty() || !releases.insert(release))
        {
            return Err(invalid("Ambiguous released registry identity"));
        }
        additions(&registry::parse(raw)?, &current)?;
    }
    Ok(catalog)
}

pub(super) fn stored_snapshot(db: &Connection) -> Result<String> {
    let rows: Vec<(i64, String)> = db
        .prepare("SELECT singleton,schema_json FROM product_registry")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<std::result::Result<_, _>>()?;
    if rows.len() != 1 || rows[0].0 != 1 {
        return Err(Error::new(
            "corrupt",
            "Ambiguous or missing product registry snapshot",
        ));
    }
    Ok(rows.into_iter().next().expect("One checked snapshot").1)
}

pub(super) fn migrate_registry(db: &Connection, stored: &str, hooks: &Hooks) -> Result<()> {
    migrate_registry_to(db, stored, registry::REGISTRY_JSON, hooks)
}

pub(super) fn migrate_registry_to(
    db: &Connection,
    stored: &str,
    current_json: &str,
    hooks: &Hooks,
) -> Result<()> {
    let catalog = validate_catalog(CATALOG_JSON, current_json, SNAPSHOTS)?;
    let current = registry::parse(current_json)?;
    let target = digest(current_json.as_bytes());
    db.execute_batch("BEGIN IMMEDIATE")?;
    let result = (|| -> Result<()> {
        let identity: String =
            db.query_row("SELECT registry_hash FROM product_workspace", [], |row| {
                row.get(0)
            })?;
        if identity != stored {
            return Err(invalid("Product registry changed before upgrade"));
        }
        let has_snapshot: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='product_registry')",
            [],
            |row| row.get(0),
        )?;
        // Existing metadata is authoritative. Corruption never falls back to a released hash.
        let raw = if has_snapshot {
            stored_snapshot(db)?
        } else {
            let entry = catalog
                .registries
                .iter()
                .find(|entry| entry.sha256 == stored)
                .ok_or_else(|| invalid("Unsupported full-product registry without a snapshot"))?;
            SNAPSHOTS
                .iter()
                .find(|(file, _)| *file == entry.file)
                .expect("Validated compiled snapshot")
                .1
                .to_owned()
        };
        if digest(raw.as_bytes()) != stored {
            return Err(Error::new(
                "corrupt",
                "Persisted registry snapshot hash mismatch",
            ));
        }
        let source = registry::parse(&raw)?;
        let added = additions(&source, &current)?;
        // Validate the complete source before additions can legitimize orphaned data.
        validate_open_for_registry(db, &raw, has_snapshot)?;
        if has_snapshot && stored == target {
            db.execute_batch("COMMIT")?;
            return Ok(());
        }
        if !has_snapshot {
            db.execute_batch(REGISTRY_SCHEMA)?;
            db.execute("INSERT INTO product_registry VALUES (1,?)", [current_json])?;
        } else {
            db.execute(
                "UPDATE product_registry SET schema_json=? WHERE singleton=1",
                [current_json],
            )?;
        }
        for name in added {
            db.execute("INSERT INTO product_tables VALUES (?,0)", [name])?;
        }
        db.execute(
            "UPDATE product_workspace SET registry_hash=? WHERE registry_hash=?",
            params![target, stored],
        )?;
        validate_open_for_registry(db, current_json, true)?;
        hooks.hit("product-registry-precommit")?;
        db.execute_batch("COMMIT")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = db.execute_batch("ROLLBACK");
    }
    result
}
