//! Closed native MCP wire. Saved IDs are evidence, never bearer authority.
use crate::full_product_store::protocol::Session;
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Envelope {
    pub version: u32,
    pub operation_id: String,
    pub session: Session,
    pub host_session_id: Option<String>,
    pub action: Action,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Binding {
    pub server_id: String,
    pub config_revision: u64,
    pub manifest_revision: String,
    pub registration_id: String,
    pub host_session_id: String,
    pub principal_revision: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct PrivateRef {
    pub kind: String,
    pub owner_id: String,
    pub revision_id: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Scope {
    pub run_id: String,
    pub call_id: String,
    pub scope_id: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum Target {
    Tool { raw_name: String },
    Resource { handle_id: String },
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Authority {
    pub authority_id: String,
    pub binding: Binding,
    pub scope: Scope,
    pub target: Target,
    pub arguments_digest: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Identity {
    pub operation_id: String,
    pub authority: Authority,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(
    tag = "transport",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum PrivateConfig {
    Stdio {
        executable: String,
        args: Vec<String>,
        cwd: Option<String>,
        environment: std::collections::HashMap<String, String>,
    },
    StreamableHttp {
        endpoint: String,
        auth: Auth,
    },
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum Auth {
    None,
    Manual {
        headers: std::collections::HashMap<String, String>,
    },
    Oauth {
        client_id: Option<String>,
        scopes: Vec<String>,
    },
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum Action {
    Capabilities {},
    PrivatePrepare {
        server_id: String,
        catalogue_revision: u64,
        expected_config_revision: u64,
        config: PrivateConfig,
    },
    PrivateStatus {
        server_id: String,
    },
    PrivateDiscard {
        server_id: String,
        reference: PrivateRef,
    },
    PrivateConfirm {
        server_id: String,
        reference: PrivateRef,
        catalogue_fingerprint: String,
    },
    Retire {
        server_id: String,
        expected_config_revision: Option<u64>,
    },
    Connect {
        server_id: String,
        config_revision: u64,
        private_revision: PrivateRef,
    },
    Disconnect {
        binding: Binding,
    },
    Prepare {
        binding: Binding,
        scope: Scope,
        target: Target,
        arguments: Value,
    },
    Invoke {
        identity: Identity,
        arguments: Value,
    },
    Status {
        identity: Identity,
    },
    Stop {
        identity: Identity,
    },
    OauthBegin {
        server_id: String,
        config_revision: u64,
        private_revision: PrivateRef,
    },
    OauthStatus {
        attempt_id: String,
    },
    OauthCancel {
        attempt_id: String,
    },
    Dispose {},
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Reply {
    pub version: u32,
    pub operation_id: String,
    pub status: String,
    pub host_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<SafeError>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SafeError {
    pub code: String,
    pub message: String,
}
impl Reply {
    pub fn new(operation: &str, host: &str, status: &str, result: Value) -> Self {
        Self {
            version: 1,
            operation_id: operation.into(),
            host_session_id: host.into(),
            status: status.into(),
            result: Some(result),
            error: None,
        }
    }
    pub fn error(operation: &str, host: &str, code: &str) -> Self {
        Self {
            version: 1,
            operation_id: operation.into(),
            host_session_id: host.into(),
            status: "unknown".into(),
            result: None,
            error: Some(SafeError {
                code: code.into(),
                message: format!("MCP {code}"),
            }),
        }
    }
}
