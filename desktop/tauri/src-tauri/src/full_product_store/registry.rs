//! The exact current shared table registry is the only native table/index allowlist.
use crate::{Error, Result};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::OnceLock,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Index {
    pub name: String,
    pub key_paths: Vec<String>,
    pub unique: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Table {
    pub key_path: String,
    pub scope: String,
    pub indexes: Vec<Index>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Registry {
    version: u32,
    tables: BTreeMap<String, Table>,
}
pub const REGISTRY_JSON: &str = include_str!("../../../../../src/lib/storage/schema.json");
pub fn tables() -> &'static BTreeMap<String, Table> {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    &REGISTRY
        .get_or_init(|| {
            let value: Registry =
                serde_json::from_str(REGISTRY_JSON).expect("Bundled table registry");
            assert_eq!(value.version, 1);
            assert_eq!(value.tables.len(), 50);
            assert!(
                value
                    .tables
                    .values()
                    .all(|t| matches!(t.scope.as_str(), "content" | "device" | "mixed"))
            );
            value
        })
        .tables
}
pub fn table(name: &str) -> Result<&'static Table> {
    tables()
        .get(name)
        .ok_or_else(|| Error::new("invalid", "Unknown product table"))
}
pub fn key_text(value: &str) -> Result<()> {
    super::protocol::WireText::from_internal(value).map(|_| ())
}
pub fn uuid(value: &str) -> Result<()> {
    if uuid::Uuid::parse_str(value).is_err()
        || uuid::Uuid::parse_str(value).is_ok_and(|id| id.to_string() != value)
    {
        return Err(Error::new(
            "invalid",
            "Expected canonical operation/session UUID",
        ));
    }
    Ok(())
}
pub fn hash(value: &str) -> Result<()> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(Error::new("invalid", "Expected lowercase SHA-256"));
    }
    Ok(())
}
pub fn encoded(value: &Value, depth: usize) -> Result<()> {
    if depth > 256 {
        return Err(Error::new("invalid", "Encoded record nesting is too deep"));
    }
    let node = value
        .as_array()
        .ok_or_else(|| Error::new("invalid", "Invalid encoded value"))?;
    let tag = node
        .first()
        .and_then(Value::as_str)
        .ok_or_else(|| Error::new("invalid", "Missing value tag"))?;
    let bad = || Error::new("invalid", "Malformed encoded value");
    match (tag, node.len()) {
        ("undef" | "null", 1) => (),
        ("str" | "date", 2) if node[1].is_string() => (),
        ("bool", 2) if node[1].is_boolean() => (),
        ("num", 2)
            if node[1].is_number()
                || node[1]
                    .as_str()
                    .is_some_and(|v| matches!(v, "NaN" | "Infinity" | "-Infinity" | "-0")) => {}
        ("bytes" | "utf16", 2) => {
            let max = if tag == "bytes" { 255 } else { 65535 };
            for byte in node[1].as_array().ok_or_else(bad)? {
                if byte.as_u64().is_none_or(|n| n > max) {
                    return Err(bad());
                }
            }
        }
        ("arr", 2) => {
            for item in node[1].as_array().ok_or_else(bad)? {
                encoded(item, depth + 1)?;
            }
        }
        ("obj" | "obj16", 2) => {
            let mut names = BTreeSet::new();
            for item in node[1].as_array().ok_or_else(bad)? {
                let entry = item.as_array().ok_or_else(bad)?;
                if entry.len() != 2 {
                    return Err(bad());
                }
                let name = if tag == "obj" {
                    entry[0]
                        .as_str()
                        .ok_or_else(bad)?
                        .encode_utf16()
                        .collect::<Vec<_>>()
                } else {
                    entry[0]
                        .as_array()
                        .ok_or_else(bad)?
                        .iter()
                        .map(|n| {
                            n.as_u64()
                                .filter(|n| *n <= 65535)
                                .map(|n| n as u16)
                                .ok_or_else(bad)
                        })
                        .collect::<Result<Vec<_>>>()?
                };
                if !names.insert(name) {
                    return Err(bad());
                }
                encoded(&entry[1], depth + 1)?;
            }
        }
        ("binary", 2) => {
            let reference: super::protocol::BinaryRef = serde_json::from_value(node[1].clone())?;
            reference.validate()?;
        }
        _ => return Err(bad()),
    }
    Ok(())
}
pub fn field<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for part in path.split('.') {
        let node = current.as_array()?;
        let tag = node.first()?.as_str()?;
        if tag != "obj" && tag != "obj16" {
            return None;
        }
        current = node.get(1)?.as_array()?.iter().find_map(|entry| {
            let item = entry.as_array()?;
            let name = if tag == "obj" {
                item.first()?.as_str()?.into()
            } else {
                String::from_utf16(
                    &item
                        .first()?
                        .as_array()?
                        .iter()
                        .map(|n| n.as_u64().map(|n| n as u16))
                        .collect::<Option<Vec<_>>>()?,
                )
                .ok()?
            };
            (name == part).then(|| item.get(1)).flatten()
        })?;
    }
    Some(current)
}
pub fn primary(value: &Value, table_name: &str) -> Result<String> {
    encoded(value, 0)?;
    let node = field(value, &table(table_name)?.key_path)
        .and_then(Value::as_array)
        .ok_or_else(|| Error::new("invalid", "Missing encoded primary key"))?;
    let text = match node.first().and_then(Value::as_str) {
        Some("str") => super::protocol::WireText::from(
            node[1]
                .as_str()
                .ok_or_else(|| Error::new("invalid", "Invalid primary key"))?,
        ),
        Some("utf16") => super::protocol::WireText::from_units(
            &node[1]
                .as_array()
                .ok_or_else(|| Error::new("invalid", "Invalid UTF16 primary key"))?
                .iter()
                .map(|v| {
                    v.as_u64()
                        .and_then(|n| u16::try_from(n).ok())
                        .ok_or_else(|| Error::new("invalid", "Invalid UTF16 identity"))
                })
                .collect::<Result<Vec<_>>>()?,
        ),
        _ => {
            return Err(Error::new(
                "invalid",
                "Product primary key must be a string",
            ));
        }
    };
    Ok(text.to_string())
}
