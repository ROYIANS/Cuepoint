//! Native PKCE/metadata/refresh uses the released SDK. No reactive POST replay.
use super::{
    McpError, Result,
    protocol::{Auth, PrivateConfig},
    transport::BoundedHttpClient,
    vault::CredentialVault,
};
use rmcp::transport::auth::{
    AuthError, AuthorizationManager, AuthorizationMetadata, AuthorizationMetadataSource,
    AuthorizationRequest, AuthorizationSession, CredentialRefreshGuard, CredentialStore,
    OAuthHttpClient, OAuthHttpClientFuture, OAuthHttpRequest, StoredCredentials,
};
use serde_json::Value;
use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub(crate) struct VaultCredentials {
    pub vault: Arc<CredentialVault>,
    pub slot: String,
    pub current: Arc<dyn Fn() -> bool + Send + Sync>,
    pub fence: Arc<Mutex<()>>,
}
fn store_error() -> AuthError {
    AuthError::CredentialStoreError("Secure credential operation unavailable".into())
}
#[async_trait::async_trait]
impl CredentialStore for VaultCredentials {
    async fn load(&self) -> std::result::Result<Option<StoredCredentials>, AuthError> {
        if !(self.current)() {
            return Err(store_error());
        }
        let Some(bytes) = self
            .vault
            .read_slot_payload(&self.slot)
            .map_err(|_| store_error())?
        else {
            return Ok(None);
        };
        serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| store_error())
    }
    async fn save(&self, value: StoredCredentials) -> std::result::Result<(), AuthError> {
        if !(self.current)() {
            return Err(store_error());
        }
        let payload = serde_json::to_vec(&value).map_err(|_| store_error())?;
        let revision = format!("oauth_{}", uuid::Uuid::new_v4());
        self.vault
            .prepare(&revision, &revision, &payload)
            .map_err(|_| store_error())?;
        let _fence = self.fence.lock().map_err(|_| store_error())?;
        if !(self.current)() {
            return Err(store_error());
        }
        self.vault
            .publish_slot(&self.slot, &revision)
            .map_err(|_| store_error())
    }
    async fn clear(&self) -> std::result::Result<(), AuthError> {
        let _fence = self.fence.lock().map_err(|_| store_error())?;
        if !(self.current)() {
            return Err(store_error());
        }
        self.vault.clear_slot(&self.slot).map_err(|_| store_error())
    }
    async fn acquire_refresh_guard(
        &self,
    ) -> std::result::Result<Option<CredentialRefreshGuard>, AuthError> {
        Ok(Some(CredentialRefreshGuard::new(
            self.vault.acquire_refresh_guard().await,
        )))
    }
}

#[derive(Clone)]
struct MetadataHttp {
    allowed: Arc<Mutex<HashSet<String>>>,
    local: bool,
    resource: Arc<Mutex<Option<String>>>,
}
fn endpoint(raw: &str, local: bool) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(raw).map_err(|_| McpError::Endpoint)?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.as_str().len() > 8192
    {
        return Err(McpError::Endpoint);
    }
    let loopback = url
        .host_str()
        .is_some_and(|h| matches!(h, "localhost" | "127.0.0.1" | "[::1]" | "::1"));
    if url.scheme() != "https" && !(local && loopback && url.scheme() == "http") {
        return Err(McpError::Endpoint);
    }
    Ok(url)
}
impl MetadataHttp {
    fn new(resource: &str) -> Result<Self> {
        let base = endpoint(resource, true)?;
        let local = base.scheme() == "http";
        let mut allowed = HashSet::new();
        allowed.insert(base.to_string());
        let this = Self {
            allowed: Arc::new(Mutex::new(allowed)),
            local,
            resource: Arc::new(Mutex::new(None)),
        };
        this.allow_well_known(base.as_str())?;
        Ok(this)
    }
    fn allow_well_known(&self, raw: &str) -> Result<()> {
        let base = endpoint(raw, self.local)?;
        let path = base.path().trim_end_matches('/');
        let mut allowed = self.allowed.lock().map_err(|_| McpError::Endpoint)?;
        for prefix in [
            "/.well-known/oauth-protected-resource",
            "/.well-known/oauth-authorization-server",
            "/.well-known/openid-configuration",
        ] {
            for suffix in ["", path] {
                let url = base
                    .join(&format!("{prefix}{suffix}"))
                    .map_err(|_| McpError::Endpoint)?;
                allowed.insert(url.to_string());
            }
        }
        if allowed.len() > 48 {
            return Err(McpError::Limit);
        }
        Ok(())
    }
    fn record_resource(&self, bytes: &[u8]) -> Result<()> {
        let Ok(value) = serde_json::from_slice::<Value>(bytes) else {
            return Ok(());
        };
        let Some(resource) = value.get("resource").and_then(Value::as_str) else {
            return Ok(());
        };
        endpoint(resource, self.local)?;
        let mut captured = self.resource.lock().map_err(|_| McpError::Protocol)?;
        if captured
            .as_deref()
            .is_some_and(|previous| previous != resource)
        {
            return Err(McpError::Protocol);
        }
        *captured = Some(resource.to_owned());
        Ok(())
    }
    fn resolved_resource(
        &self,
        source: AuthorizationMetadataSource,
        configured: &str,
    ) -> Result<String> {
        let captured = self
            .resource
            .lock()
            .map_err(|_| McpError::Protocol)?
            .clone();
        match (source, captured) {
            // The released SDK does not expose discovered_resource. A successful
            // PRM resolution plus one exact captured candidate proves the value
            // the SDK accepted; conflicting/unaccepted candidates fail closed.
            (AuthorizationMetadataSource::ProtectedResourceMetadata, Some(resource)) => {
                Ok(resource)
            }
            (AuthorizationMetadataSource::AuthorizationServerMetadata, None) => {
                Ok(endpoint(configured, self.local)?.to_string())
            }
            _ => Err(McpError::Protocol),
        }
    }
    fn learn(&self, bytes: &[u8]) -> Result<()> {
        let Ok(value) = serde_json::from_slice::<Value>(bytes) else {
            return Ok(());
        };
        if let Some(servers) = value.get("authorization_servers").and_then(Value::as_array) {
            if servers.len() > 4 {
                return Err(McpError::Limit);
            }
            for server in servers {
                self.allow_well_known(server.as_str().ok_or(McpError::Protocol)?)?;
            }
        }
        for key in ["authorization_server", "issuer"] {
            if let Some(server) = value.get(key).and_then(Value::as_str) {
                self.allow_well_known(server)?;
            }
        }
        for key in [
            "token_endpoint",
            "registration_endpoint",
            "authorization_endpoint",
        ] {
            if let Some(raw) = value.get(key).and_then(Value::as_str) {
                let url = endpoint(raw, self.local)?;
                self.allowed
                    .lock()
                    .map_err(|_| McpError::Endpoint)?
                    .insert(url.to_string());
            }
        }
        Ok(())
    }
}
impl OAuthHttpClient for MetadataHttp {
    fn execute(&self, request: OAuthHttpRequest) -> OAuthHttpClientFuture<'_> {
        Box::pin(async move {
            let raw = request.request.uri().to_string();
            let metadata_get = request.request.method() == http::Method::GET;
            if !self
                .allowed
                .lock()
                .map_err(|_| McpError::Endpoint)?
                .contains(&raw)
            {
                return Err(Box::new(McpError::Endpoint) as _);
            }
            let url = endpoint(&raw, self.local)?;
            let response = BoundedHttpClient::new(vec![url], 64 * 1024)?
                .execute(request)
                .await?;
            if metadata_get && response.status().is_success() {
                self.record_resource(response.body())?;
            }
            self.learn(response.body())?;
            Ok(response)
        })
    }
}
struct ResolvedManager {
    manager: AuthorizationManager,
    resource: String,
    metadata: AuthorizationMetadata,
}
async fn manager(config: &PrivateConfig, credentials: VaultCredentials) -> Result<ResolvedManager> {
    let PrivateConfig::StreamableHttp {
        endpoint,
        auth: Auth::Oauth { .. },
    } = config
    else {
        return Err(McpError::Protocol);
    };
    let client = MetadataHttp::new(endpoint)?;
    let mut manager =
        AuthorizationManager::new_with_oauth_http_client(endpoint, Arc::new(client.clone()))
            .await
            .map_err(|_| McpError::Protocol)?;
    manager.set_credential_store(credentials);
    let resolution = manager
        .resolve_metadata()
        .await
        .map_err(|_| McpError::Protocol)?;
    if !resolution.source.is_discovered() {
        return Err(McpError::Protocol);
    }
    let resource = client.resolved_resource(resolution.source, endpoint)?;
    let metadata = resolution.metadata;
    manager.set_metadata(metadata.clone());
    Ok(ResolvedManager {
        manager,
        resource,
        metadata,
    })
}
pub(crate) struct AccessToken {
    pub access_token: String,
    pub principal_identity: String,
}
pub(crate) async fn token(config: &PrivateConfig, credentials: VaultCredentials) -> Result<String> {
    Ok(token_with_identity(config, credentials).await?.access_token)
}
pub(crate) async fn token_with_identity(
    config: &PrivateConfig,
    credentials: VaultCredentials,
) -> Result<AccessToken> {
    let resolved = manager(config, credentials.clone()).await?;
    let resource = resolved.resource;
    let mut manager = resolved.manager;
    if !manager
        .initialize_from_store()
        .await
        .map_err(|_| McpError::AuthRequired)?
    {
        return Err(McpError::AuthRequired);
    }
    let access_token = manager
        .get_access_token()
        .await
        .map_err(|_| McpError::AuthRequired)?;
    let stored = credentials
        .load()
        .await
        .map_err(|_| McpError::AuthRequired)?
        .ok_or(McpError::AuthRequired)?;
    let PrivateConfig::StreamableHttp { endpoint, .. } = config else {
        return Err(McpError::Protocol);
    };
    let scopes = stored
        .granted_scopes
        .iter()
        .collect::<std::collections::BTreeSet<_>>();
    let principal_identity = super::catalogue::digest(
        &serde_json::to_vec(&(endpoint, resource, stored.issuer, stored.client_id, scopes))
            .map_err(|_| McpError::Protocol)?,
    );
    Ok(AccessToken {
        access_token,
        principal_identity,
    })
}

pub(crate) struct Login {
    pub server_id: String,
    pub attempt_id: String,
    pub redirect: String,
    pub authorization_url: String,
    pub cancel: CancellationToken,
    pub state: Arc<Mutex<String>>,
    pub task: tokio::task::JoinHandle<()>,
}
pub(crate) async fn begin(
    config: PrivateConfig,
    credentials: VaultCredentials,
    current: Arc<dyn Fn() -> bool + Send + Sync>,
    open: Arc<dyn Fn(&str) -> Result<()> + Send + Sync>,
) -> Result<Login> {
    begin_with_timeout(config, credentials, current, open, Duration::from_secs(300)).await
}
pub(crate) async fn begin_tracked(
    config: PrivateConfig,
    credentials: VaultCredentials,
    current: Arc<dyn Fn() -> bool + Send + Sync>,
    open: Arc<dyn Fn(&str) -> Result<()> + Send + Sync>,
    tracker: tokio_util::task::TaskTracker,
) -> Result<Login> {
    begin_owned(
        config,
        credentials,
        current,
        open,
        Duration::from_secs(300),
        Some(tracker),
    )
    .await
}
pub(crate) async fn begin_with_timeout(
    config: PrivateConfig,
    credentials: VaultCredentials,
    current: Arc<dyn Fn() -> bool + Send + Sync>,
    open: Arc<dyn Fn(&str) -> Result<()> + Send + Sync>,
    timeout: Duration,
) -> Result<Login> {
    begin_owned(config, credentials, current, open, timeout, None).await
}
async fn begin_owned(
    config: PrivateConfig,
    credentials: VaultCredentials,
    current: Arc<dyn Fn() -> bool + Send + Sync>,
    open: Arc<dyn Fn(&str) -> Result<()> + Send + Sync>,
    timeout: Duration,
    tracker: Option<tokio_util::task::TaskTracker>,
) -> Result<Login> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| McpError::Transport)?;
    let redirect = format!(
        "http://127.0.0.1:{}/cuepoint-mcp-oauth",
        listener
            .local_addr()
            .map_err(|_| McpError::Transport)?
            .port()
    );
    let publication_fence = credentials.fence.clone();
    let resolved = manager(&config, credentials).await?;
    let manager = resolved.manager;
    let metadata = resolved.metadata;
    let issuer = metadata.issuer.ok_or(McpError::Protocol)?;
    let require_issuer = metadata
        .additional_fields
        .get("authorization_response_iss_parameter_supported")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let PrivateConfig::StreamableHttp {
        auth: Auth::Oauth { client_id, scopes },
        ..
    } = config
    else {
        return Err(McpError::Protocol);
    };
    let mut request = AuthorizationRequest::new(&redirect)
        .with_application_type("native")
        .with_client_name("Cuepoint")
        .with_scopes(scopes);
    if let Some(client) = client_id {
        request = request.with_preregistered_client(client)
    }
    let session = AuthorizationSession::new(manager, request)
        .await
        .map_err(|_| McpError::Protocol)?;
    let authorization_url = session.auth_url.clone();
    let auth_url = reqwest::Url::parse(&authorization_url).map_err(|_| McpError::Endpoint)?;
    let expected_state = auth_url
        .query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.into_owned())
        .ok_or(McpError::Protocol)?;
    {
        let _fence = publication_fence
            .lock()
            .map_err(|_| McpError::VaultUnavailable)?;
        if !(current)() {
            return Err(McpError::VaultConflict);
        }
        open(&authorization_url)?;
    }
    let state = Arc::new(Mutex::new("pending".to_owned()));
    let task_state = state.clone();
    let cancel = CancellationToken::new();
    let task_cancel = cancel.clone();
    let task_redirect = redirect.clone();
    let task_body = async move {
        let work = async {
            loop {
                let (mut socket, address) =
                    listener.accept().await.map_err(|_| McpError::Transport)?;
                if !address.ip().is_loopback() {
                    continue;
                }
                let mut bytes = Vec::new();
                let mut buf = [0u8; 1024];
                while bytes.windows(4).all(|v| v != b"\r\n\r\n") {
                    let n = tokio::time::timeout(Duration::from_secs(3), socket.read(&mut buf))
                        .await
                        .map_err(|_| McpError::Deadline)?
                        .map_err(|_| McpError::Transport)?;
                    if n == 0 {
                        return Err(McpError::Protocol);
                    }
                    if bytes.len() + n > 8192 {
                        return Err(McpError::Limit);
                    }
                    bytes.extend_from_slice(&buf[..n]);
                }
                let request = std::str::from_utf8(&bytes).map_err(|_| McpError::Protocol)?;
                let mut first = request.lines().next().unwrap_or("").split_whitespace();
                let method = first.next().unwrap_or("");
                let path = first.next().unwrap_or("");
                let callback = reqwest::Url::parse(&format!(
                    "{}{}",
                    task_redirect
                        .split("/cuepoint-mcp-oauth")
                        .next()
                        .unwrap_or(""),
                    path
                ))
                .map_err(|_| McpError::Protocol)?;
                let host = request.lines().find_map(|line| {
                    line.split_once(':')
                        .filter(|(k, _)| k.eq_ignore_ascii_case("host"))
                        .map(|(_, v)| v.trim())
                });
                let expected_host = task_redirect
                    .trim_start_matches("http://")
                    .split('/')
                    .next()
                    .unwrap_or("");
                let pairs = callback.query_pairs().collect::<Vec<_>>();
                let count = |key: &str| pairs.iter().filter(|(k, _)| k == key).count();
                let incoming_issuer = pairs
                    .iter()
                    .find(|(k, _)| k == "iss")
                    .map(|(_, v)| v.as_ref());
                let valid = path.starts_with("/cuepoint-mcp-oauth?")
                    && callback.origin().ascii_serialization()
                        == task_redirect
                            .split("/cuepoint-mcp-oauth")
                            .next()
                            .unwrap_or("")
                    && incoming_issuer.map_or(!require_issuer, |v| v == issuer)
                    && method == "GET"
                    && host == Some(expected_host)
                    && callback.path() == "/cuepoint-mcp-oauth"
                    && count("state") == 1
                    && pairs
                        .iter()
                        .find(|(k, _)| k == "state")
                        .is_some_and(|(_, v)| v == &expected_state)
                    && count("code") <= 1
                    && count("iss") <= 1
                    && count("error") <= 1;
                if !valid || !(current)() {
                    let _=socket.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                    continue;
                }
                let result = session
                    .handle_callback_url(callback.as_str())
                    .await
                    .map_err(|_| McpError::Protocol);
                let _=socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 21\r\nConnection: close\r\n\r\nReturn to Cuepoint app").await;
                result?;
                if !(current)() {
                    return Err(McpError::VaultConflict);
                }
                return Ok(());
            }
        };
        let result = tokio::select! {_ = task_cancel.cancelled()=>"canceled",result=tokio::time::timeout(timeout,work)=>match result{Ok(Ok(()))=>"authorized",Ok(Err(_))=>"failed",Err(_)=>"expired"}};
        if let Ok(mut state) = task_state.lock() {
            *state = result.into()
        }
    };
    let task = if let Some(tracker) = tracker {
        tracker.spawn(task_body)
    } else {
        tokio::spawn(task_body)
    };
    Ok(Login {
        server_id: String::new(),
        attempt_id: format!("login_{}", uuid::Uuid::new_v4()),
        redirect,
        authorization_url,
        cancel,
        state,
        task,
    })
}
