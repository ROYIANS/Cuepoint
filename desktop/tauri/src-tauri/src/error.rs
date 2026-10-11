use serde::Serialize;
use std::fmt;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Error {
    pub code: &'static str,
    pub message: String,
}

impl Error {
    pub(crate) fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for Error {}
impl From<std::io::Error> for Error {
    fn from(value: std::io::Error) -> Self {
        Self::new("io", value.to_string())
    }
}
impl From<rusqlite::Error> for Error {
    fn from(value: rusqlite::Error) -> Self {
        Self::new("sqlite", value.to_string())
    }
}
impl From<serde_json::Error> for Error {
    fn from(value: serde_json::Error) -> Self {
        Self::new("wire", value.to_string())
    }
}
