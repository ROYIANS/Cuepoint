//! The exact current shared table registry is the only native table/index allowlist.
use crate::{Error, Result};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::OnceLock,
};

#[derive(Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Index {
    pub name: String,
    pub key_paths: Vec<String>,
    pub unique: bool,
}
#[derive(Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Table {
    pub key_path: String,
    pub scope: String,
    pub indexes: Vec<Index>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Registry {
    pub version: u32,
    #[serde(deserialize_with = "unique_tables")]
    pub tables: BTreeMap<String, Table>,
}
fn unique_tables<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<BTreeMap<String, Table>, D::Error> {
    struct Tables;
    impl<'de> serde::de::Visitor<'de> for Tables {
        type Value = BTreeMap<String, Table>;
        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter.write_str("unique product table definitions")
        }
        fn visit_map<M: serde::de::MapAccess<'de>>(
            self,
            mut map: M,
        ) -> std::result::Result<Self::Value, M::Error> {
            let mut tables = BTreeMap::new();
            while let Some((name, table)) = map.next_entry::<String, Table>()? {
                if tables.insert(name, table).is_some() {
                    return Err(serde::de::Error::custom(
                        "Duplicate product table definition",
                    ));
                }
            }
            Ok(tables)
        }
    }
    deserializer.deserialize_map(Tables)
}
pub(super) fn parse(raw: &str) -> Result<Registry> {
    let registry: Registry = serde_json::from_str(raw)
        .map_err(|error| Error::new("schema", format!("Invalid product registry: {error}")))?;
    let path = |value: &str| !value.is_empty() && value.split('.').all(|part| !part.is_empty());
    if registry.version != 1 || registry.tables.is_empty() {
        return Err(Error::new(
            "schema",
            "Unsupported or empty product registry",
        ));
    }
    for (name, table) in &registry.tables {
        let mut indexes = BTreeSet::new();
        if name.is_empty()
            || !path(&table.key_path)
            || !matches!(table.scope.as_str(), "content" | "device" | "mixed")
            || table.indexes.iter().any(|index| {
                index.name.is_empty()
                    || index.name == "$primary"
                    || !indexes.insert(index.name.as_str())
                    || index.key_paths.is_empty()
                    || index.key_paths.iter().any(|value| !path(value))
            })
        {
            return Err(Error::new("schema", "Invalid product table definition"));
        }
    }
    Ok(registry)
}
pub const REGISTRY_JSON: &str =
    include_str!("../../../../../packages/studio/src/platform/storage/schema.json");
pub fn tables() -> &'static BTreeMap<String, Table> {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    &REGISTRY
        .get_or_init(|| parse(REGISTRY_JSON).expect("Bundled table registry"))
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
    primary_for_table(value, table(table_name)?)
}
pub(super) fn primary_for_table(value: &Value, definition: &Table) -> Result<String> {
    encoded(value, 0)?;
    let node = field(value, &definition.key_path)
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
