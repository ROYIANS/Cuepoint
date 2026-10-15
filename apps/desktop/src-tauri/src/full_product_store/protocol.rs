use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct BinaryRef {
    pub version: u32,
    pub workspace_id: String,
    pub binary_id: String,
    pub byte_length: u64,
    pub mime_type: String,
    pub content_hash: String,
}
impl BinaryRef {
    pub fn validate(&self) -> Result<()> {
        if self.version != 1
            || self.byte_length > 9_007_199_254_740_991
            || self.mime_type.len() > 256
            || self.mime_type.chars().any(char::is_control)
        {
            return Err(Error::new("invalid", "Invalid managed binary reference"));
        }
        super::registry::uuid(&self.workspace_id)?;
        super::registry::uuid(&self.binary_id)?;
        super::registry::hash(&self.content_hash)
    }
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct BinaryClaim {
    pub reference: BinaryRef,
    pub stage_id: String,
}
/// Exact JS text: SQL storage is a canonical hex UTF-16 sequence, including lone
/// surrogates, empty strings, and NUL. IPC uses a string when Unicode is well formed.
#[derive(Clone, Debug)]
pub struct WireText(String);
impl WireText {
    pub fn from_units(units: &[u16]) -> Self {
        use std::fmt::Write;
        let mut text = String::with_capacity(units.len() * 4);
        for unit in units {
            write!(&mut text, "{unit:04x}").expect("Write string");
        }
        Self(text)
    }
    pub fn from_internal(text: &str) -> Result<Self> {
        if !text.len().is_multiple_of(4)
            || !text
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(Error::new("corrupt", "Invalid stored UTF-16 identity"));
        }
        Ok(Self(text.into()))
    }
    pub fn units(&self) -> Vec<u16> {
        self.0
            .as_bytes()
            .as_chunks::<4>()
            .0
            .iter()
            .map(|chunk| {
                u16::from_str_radix(std::str::from_utf8(chunk).expect("Canonical UTF16 hex"), 16)
                    .expect("Canonical UTF16 hex")
            })
            .collect()
    }
}
impl From<&str> for WireText {
    fn from(text: &str) -> Self {
        Self::from_units(&text.encode_utf16().collect::<Vec<_>>())
    }
}
impl From<String> for WireText {
    fn from(text: String) -> Self {
        Self::from(text.as_str())
    }
}
impl std::ops::Deref for WireText {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}
impl rusqlite::types::ToSql for WireText {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(rusqlite::types::ToSqlOutput::Borrowed(
            rusqlite::types::ValueRef::Text(self.0.as_bytes()),
        ))
    }
}
impl Serialize for WireText {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        let units = self.units();
        match String::from_utf16(&units) {
            Ok(text) => serializer.serialize_str(&text),
            Err(_) => {
                use serde::ser::SerializeMap;
                let mut map = serializer.serialize_map(Some(1))?;
                map.serialize_entry("utf16", &units)?;
                map.end()
            }
        }
    }
}
impl<'de> Deserialize<'de> for WireText {
    fn deserialize<D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Units {
            utf16: Vec<u16>,
        }
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Text {
            String(String),
            Units(Units),
        }
        Ok(match Text::deserialize(deserializer)? {
            Text::String(text) => Self::from(text),
            Text::Units(units) => Self::from_units(&units.utf16),
        })
    }
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Key {
    String { value: WireText },
    Number { value: NumericKey },
    Array { value: Vec<Key> },
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum NumericKey {
    Finite(f64),
    Special(String),
}
impl NumericKey {
    pub fn value(&self) -> Result<f64> {
        match self {
            Self::Finite(v) if v.is_finite() => Ok(*v),
            Self::Special(s) if s == "Infinity" => Ok(f64::INFINITY),
            Self::Special(s) if s == "-Infinity" => Ok(f64::NEG_INFINITY),
            _ => Err(Error::new("invalid", "Invalid numeric index key")),
        }
    }
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Selector {
    All,
    Equals { keys: Vec<Key> },
    AnyOf { keys: Vec<Key> },
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Query {
    pub table: String,
    pub index: Option<String>,
    pub selector: Selector,
    pub reverse: bool,
    pub cursor: Option<String>,
    pub page_size: usize,
    #[serde(default)]
    pub limit: Option<usize>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Mutation {
    Put {
        table: String,
        key: WireText,
        value: Value,
    },
    Add {
        table: String,
        key: WireText,
        value: Value,
    },
    Delete {
        table: String,
        key: WireText,
    },
}
impl Mutation {
    pub fn table(&self) -> &str {
        match self {
            Self::Put { table, .. } | Self::Add { table, .. } | Self::Delete { table, .. } => table,
        }
    }
    pub fn key(&self) -> &str {
        match self {
            Self::Put { key, .. } | Self::Add { key, .. } | Self::Delete { key, .. } => key,
        }
    }
    pub fn value(&self) -> Option<&Value> {
        match self {
            Self::Put { value, .. } | Self::Add { value, .. } => Some(value),
            Self::Delete { .. } => None,
        }
    }
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum BatchEntry {
    Mutation { mutation: Mutation },
    Claim { claim: BinaryClaim },
}

macro_rules! request {
    ($name:ident {$($field:ident: $type:ty),* $(,)?}) => {
        #[derive(Clone, Deserialize, Serialize)]
        #[serde(deny_unknown_fields, rename_all = "camelCase")]
        pub struct $name {pub version: u32, pub session: String, pub workspace_id: String, pub generation: u64, $(pub $field: $type,)*}
    }
}
request!(Session {});
request!(Begin {operation_id: String, mode: String, tables: Vec<String>});
request!(Handle {
    handle: String,
    operation_id: String
});
request!(Get {handle: String, operation_id: String, table: String, keys: Vec<WireText>});
request!(ReadQuery {
    handle: String,
    operation_id: String,
    query: Query
});
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReadPurpose {
    Get,
    Query,
    Count,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct GetPayload {
    pub table: String,
    pub keys: Vec<WireText>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct QueryPayload {
    pub query: Query,
}
request!(RequestStart {
    handle: String,
    operation_id: String,
    purpose: ReadPurpose
});
request!(RequestChunk {
    handle: String,
    operation_id: String,
    transfer_id: String,
    offset: usize,
    payload: String
});
request!(RequestFinish {
    handle: String,
    operation_id: String,
    transfer_id: String
});
request!(Prepare {
    handle: String,
    operation_id: String,
    chunk_index: usize,
    payload: String
});
request!(Seal {
    handle: String,
    operation_id: String,
    chunk_count: usize,
    fingerprint: String
});
request!(Commit {
    handle: String,
    operation_id: String,
    capability: String,
    fingerprint: String
});
request!(Status {
    operation_id: String,
    fingerprint: String
});
request!(ReadTransfer {
    handle: String,
    operation_id: String,
    transfer_id: String,
    offset: usize,
    byte_length: usize
});
request!(Changes {change_sequence: u64, cursor: Option<String>, page_size: usize});
request!(ReadChangeTransfer {
    transfer_id: String,
    offset: usize,
    byte_length: usize
});
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Empty {}
#[derive(Clone, Deserialize, Serialize)]
#[serde(
    tag = "type",
    content = "request",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum Request {
    Open(Empty),
    Begin(Begin),
    Get(Get),
    Query(ReadQuery),
    Count(ReadQuery),
    RequestStart(RequestStart),
    RequestChunk(RequestChunk),
    RequestFinish(RequestFinish),
    Prepare(Prepare),
    Seal(Seal),
    Commit(Commit),
    Validate(Handle),
    Abort(Handle),
    Status(Status),
    ReadTransfer(ReadTransfer),
    Changes(Changes),
    ReadChangeTransfer(ReadChangeTransfer),
}
impl Request {
    /// Only the actual outer IPC boundary calls this. Internally reconstructed
    /// requests may contain a larger single identity from verified text chunks.
    pub fn validate_wire(&self) -> Result<()> {
        if serde_json::to_vec(&serde_json::json!({"request":self}))?.len() > 262144 {
            return Err(Error::new(
                "invalid",
                "Product metadata IPC envelope exceeds its byte budget",
            ));
        }
        Ok(())
    }
}
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Receipt {
    pub status: String,
    pub operation_id: String,
    pub fingerprint: String,
    pub change_sequence: u64,
    pub tables: Vec<String>,
}
