use super::{
    protocol::{Key, NumericKey, Query, Selector, WireText},
    registry,
};
use crate::{Error, Result};
use rusqlite::{Connection, params_from_iter, types::Value as SqlValue};
use serde_json::Value;

/// Byte order matches the current IndexedDB number/string/array key order. Strings
/// compare UTF-16 code units (JS), not Rust scalar or SQLite UTF-8 text order.
pub fn ordered(key: &Key) -> Result<Vec<u8>> {
    fn append(out: &mut Vec<u8>, key: &Key, depth: usize) -> Result<()> {
        if depth > 128 {
            return Err(Error::new("invalid", "Index key nesting"));
        }
        match key {
            Key::Number { value } => {
                let value = value.value()?;
                out.push(1);
                let value = if value == 0.0 { 0.0 } else { value };
                let bits = value.to_bits();
                let bits = if bits >> 63 == 1 {
                    !bits
                } else {
                    bits ^ (1 << 63)
                };
                out.extend_from_slice(&bits.to_be_bytes());
            }
            Key::String { value } => {
                out.push(2);
                // Every code unit has a nonzero prefix, leaving 0 as terminator.
                for unit in value.units() {
                    out.push(1);
                    out.extend_from_slice(&unit.to_be_bytes());
                }
                out.push(0);
            }
            Key::Array { value } => {
                out.push(3);
                for item in value {
                    append(out, item, depth + 1)?;
                }
                out.push(0);
            }
        }
        Ok(())
    }
    let mut result = Vec::new();
    append(&mut result, key, 0)?;
    Ok(result)
}
pub fn from_encoded(value: &Value) -> Option<Key> {
    let node = value.as_array()?;
    match node.first()?.as_str()? {
        "str" => Some(Key::String {
            value: node.get(1)?.as_str()?.into(),
        }),
        "utf16" => Some(Key::String {
            value: WireText::from_units(
                &node
                    .get(1)?
                    .as_array()?
                    .iter()
                    .map(|n| n.as_u64().and_then(|n| u16::try_from(n).ok()))
                    .collect::<Option<Vec<_>>>()?,
            ),
        }),
        "num" => {
            let value = match node.get(1)? {
                Value::Number(n) => n.as_f64()?,
                Value::String(s) => match s.as_str() {
                    "Infinity" => f64::INFINITY,
                    "-Infinity" => f64::NEG_INFINITY,
                    "-0" => 0.0,
                    _ => return None,
                },
                _ => return None,
            };
            Some(Key::Number {
                value: if value.is_finite() {
                    NumericKey::Finite(value)
                } else {
                    NumericKey::Special(if value > 0.0 { "Infinity" } else { "-Infinity" }.into())
                },
            })
        }
        "arr" => Some(Key::Array {
            value: node
                .get(1)?
                .as_array()?
                .iter()
                .map(from_encoded)
                .collect::<Option<Vec<_>>>()?,
        }),
        _ => None,
    }
}
pub fn index_values(
    table: &str,
    key: &str,
    value: Option<&Value>,
) -> Result<serde_json::Map<String, Value>> {
    let mut result = serde_json::Map::new();
    let Some(value) = value else {
        return Ok(result);
    };
    let definition = registry::table(table)?;
    result.insert(
        definition.key_path.clone(),
        serde_json::to_value(Key::String {
            value: WireText::from_internal(key)?,
        })?,
    );
    for index in &definition.indexes {
        if let Some(mut values) = index
            .key_paths
            .iter()
            .map(|path| registry::field(value, path).and_then(from_encoded))
            .collect::<Option<Vec<_>>>()
        {
            let key = if values.len() == 1 {
                values.remove(0)
            } else {
                Key::Array { value: values }
            };
            result.insert(index.name.clone(), serde_json::to_value(key)?);
        }
    }
    Ok(result)
}
pub struct Projection {
    pub index: String,
    pub ordered: Vec<u8>,
    pub unique: bool,
}
pub fn projections(table: &str, key: &str, value: &Value) -> Result<Vec<Projection>> {
    let definition = registry::table(table)?;
    let mut result = vec![Projection {
        index: "$primary".into(),
        ordered: ordered(&Key::String {
            value: WireText::from_internal(key)?,
        })?,
        unique: false,
    }];
    for index in &definition.indexes {
        let values = index
            .key_paths
            .iter()
            .map(|path| registry::field(value, path).and_then(from_encoded))
            .collect::<Option<Vec<_>>>();
        if let Some(mut values) = values {
            let index_key = if values.len() == 1 {
                values.remove(0)
            } else {
                Key::Array { value: values }
            };
            result.push(Projection {
                index: index.name.clone(),
                ordered: ordered(&index_key)?,
                unique: index.unique,
            });
        }
    }
    Ok(result)
}
pub fn index_name(query: &Query) -> Result<String> {
    let definition = registry::table(&query.table)?;
    match &query.index {
        None => Ok("$primary".into()),
        Some(index) if index == &definition.key_path || index == ":id" => Ok("$primary".into()),
        Some(index) if definition.indexes.iter().any(|v| &v.name == index) => Ok(index.clone()),
        _ => Err(Error::new("invalid", "Unregistered product index")),
    }
}
pub struct Row {
    pub key: String,
    pub value: Value,
    pub sort: Vec<u8>,
    pub primary_sort: Vec<u8>,
}
pub struct Page {
    pub rows: Vec<Row>,
    pub more: bool,
}
pub fn validate(query: &Query) -> Result<()> {
    index_name(query)?;
    if query.page_size == 0
        || query.page_size > 256
        || query
            .limit
            .is_some_and(|limit| limit as u64 > 9_007_199_254_740_991)
    {
        return Err(Error::new("invalid", "Invalid registered query page/limit"));
    }
    match &query.selector {
        Selector::All => (),
        Selector::Equals { keys } if keys.len() != 1 => {
            return Err(Error::new("invalid", "Equality selector needs one key"));
        }
        Selector::Equals { keys } | Selector::AnyOf { keys } => {
            if keys.len() > 256 {
                return Err(Error::new("invalid", "Selector key page is too large"));
            }
            for key in keys {
                ordered(key)?;
            }
        }
    }
    Ok(())
}
fn selected(query: &Query) -> Result<(String, Vec<SqlValue>)> {
    validate(query)?;
    let index = index_name(query)?;
    let mut values = vec![SqlValue::Text(query.table.clone()), SqlValue::Text(index)];
    let mut sql = String::from("i.table_name=? AND i.index_name=?");
    match &query.selector {
        Selector::All => (),
        Selector::Equals { keys } | Selector::AnyOf { keys } => {
            if matches!(query.selector, Selector::Equals { .. }) && keys.len() != 1 {
                return Err(Error::new("invalid", "Equality selector needs one key"));
            }
            if keys.len() > 256 {
                return Err(Error::new("invalid", "Selector key page is too large"));
            }
            if keys.is_empty() {
                sql.push_str(" AND 0");
                return Ok((sql, values));
            }
            sql.push_str(" AND i.sort_key IN (");
            sql.push_str(&vec!["?"; keys.len()].join(","));
            sql.push(')');
            for key in keys {
                values.push(SqlValue::Blob(ordered(key)?));
            }
        }
    }
    Ok((sql, values))
}
pub fn count(db: &Connection, query: &Query) -> Result<u64> {
    if query.cursor.is_some() {
        return Err(Error::new(
            "invalid",
            "Aggregate query cannot use a page cursor",
        ));
    }
    let (predicate, values) = selected(query)?;
    let total: i64 = db.query_row(
        &format!("SELECT COUNT(*) FROM product_indexes i WHERE {predicate}"),
        params_from_iter(values),
        |row| row.get(0),
    )?;
    if total < 0 {
        return Err(Error::new("corrupt", "Negative product count"));
    }
    let count = total as u64;
    Ok(query.limit.map_or(count, |limit| count.min(limit as u64)))
}
pub fn page(db: &Connection, query: &Query, after: Option<(&[u8], &[u8])>) -> Result<Page> {
    if query.page_size == 0 || query.page_size > 256 {
        return Err(Error::new("invalid", "Query page size must be 1–256"));
    }
    let (predicate, mut values) = selected(query)?;
    let mut sql = format!(
        "SELECT r.row_key,r.payload,i.sort_key,r.primary_sort FROM product_indexes i JOIN product_records r ON r.table_name=i.table_name AND r.row_key=i.row_key WHERE {predicate}"
    );
    let comparator = if query.reverse { "<" } else { ">" };
    if let Some((sort, primary)) = after {
        sql.push_str(&format!(
            " AND (i.sort_key {comparator} ? OR (i.sort_key=? AND r.primary_sort {comparator} ?))"
        ));
        values.extend([
            SqlValue::Blob(sort.into()),
            SqlValue::Blob(sort.into()),
            SqlValue::Blob(primary.into()),
        ]);
    }
    let order = if query.reverse { "DESC" } else { "ASC" };
    sql.push_str(&format!(
        " ORDER BY i.sort_key {order},r.primary_sort {order} LIMIT ?"
    ));
    values.push(SqlValue::Integer(query.page_size as i64 + 1));
    let mut statement = db.prepare(&sql)?;
    let mut raw = statement.query(params_from_iter(values))?;
    let mut rows = Vec::new();
    let mut bytes = 0;
    let mut more = false;
    while let Some(r) = raw.next()? {
        // Inspect length before deserializing a later large record. A page holds
        // at most one oversize row; its wire form uses the bounded read transfer.
        let payload = r
            .get_ref(1)?
            .as_str()
            .map_err(|_| Error::new("corrupt", "Product record payload is not text"))?;
        if rows.len() == query.page_size || !rows.is_empty() && bytes + payload.len() > 65536 {
            more = true;
            break;
        }
        bytes += payload.len();
        rows.push(Row {
            key: r.get(0)?,
            value: serde_json::from_str(payload)?,
            sort: r.get(2)?,
            primary_sort: r.get(3)?,
        });
    }
    Ok(Page { rows, more })
}
