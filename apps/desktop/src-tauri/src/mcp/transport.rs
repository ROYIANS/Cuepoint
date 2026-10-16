//! SDK client port with pre-parse response limits and no implicit effect retries.
use super::{MESSAGE_BYTES, McpError, REQUEST_TIMEOUT, Result, bounded};
use futures::{StreamExt, stream::BoxStream};
use http::{HeaderName, HeaderValue};
use rmcp::{
    model::{ClientJsonRpcMessage, ServerJsonRpcMessage},
    transport::{
        auth::{OAuthHttpClient, OAuthHttpClientFuture, OAuthHttpRequest},
        common::client_side_sse::NeverRetry,
        streamable_http_client::{
            StreamableHttpClient, StreamableHttpClientTransportConfig, StreamableHttpError,
            StreamableHttpPostResponse,
        },
    },
};
use sse_stream::{Error as SseError, Sse, SseStream};
use std::{collections::HashMap, sync::Arc};

type HttpResult<T> = std::result::Result<T, StreamableHttpError<McpError>>;

/// An explicitly approved endpoint set belongs to one connection/authorization
/// attempt. OAuth discovery may extend it only after issuer/resource validation.
#[derive(Clone)]
pub(crate) struct BoundedHttpClient {
    client: reqwest::Client,
    endpoints: Arc<Vec<reqwest::Url>>,
    limit: usize,
    token: Option<Arc<std::sync::Mutex<Option<String>>>>,
}
impl BoundedHttpClient {
    pub(crate) fn new(endpoints: Vec<reqwest::Url>, limit: usize) -> Result<Self> {
        Self::with_timeout(endpoints, limit, REQUEST_TIMEOUT)
    }
    pub(crate) fn with_timeout(
        endpoints: Vec<reqwest::Url>,
        limit: usize,
        timeout: std::time::Duration,
    ) -> Result<Self> {
        if timeout.is_zero() || timeout > REQUEST_TIMEOUT {
            return Err(McpError::Deadline);
        }
        if endpoints.is_empty() || endpoints.len() > 16 || limit == 0 || limit > MESSAGE_BYTES {
            return Err(McpError::Endpoint);
        }
        for endpoint in &endpoints {
            let local = endpoint.host_str().is_some_and(|h| {
                h == "localhost" || h == "127.0.0.1" || h == "[::1]" || h == "::1"
            });
            if !endpoint.username().is_empty()
                || endpoint.password().is_some()
                || endpoint.fragment().is_some()
                || (endpoint.scheme() != "https" && !(endpoint.scheme() == "http" && local))
            {
                return Err(McpError::Endpoint);
            }
        }
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(timeout)
            .connect_timeout(timeout.min(std::time::Duration::from_secs(10)))
            .build()
            .map_err(|_| McpError::Transport)?;
        Ok(Self {
            client,
            endpoints: Arc::new(endpoints),
            limit,
            token: None,
        })
    }
    pub(crate) fn with_token(mut self, token: Arc<std::sync::Mutex<Option<String>>>) -> Self {
        self.token = Some(token);
        self
    }
    fn endpoint(&self, uri: &str) -> Result<reqwest::Url> {
        let url = reqwest::Url::parse(uri).map_err(|_| McpError::Endpoint)?;
        if !self.endpoints.iter().any(|approved| approved == &url) {
            return Err(McpError::Endpoint);
        }
        Ok(url)
    }
    fn request(
        &self,
        method: reqwest::Method,
        uri: &str,
        session: Option<Arc<str>>,
        auth: Option<String>,
        headers: HashMap<HeaderName, HeaderValue>,
    ) -> Result<reqwest::RequestBuilder> {
        let mut request = self
            .client
            .request(method, self.endpoint(uri)?)
            .header("accept", "application/json, text/event-stream");
        if let Some(session) = session {
            request = request.header("mcp-session-id", session.as_ref());
        }
        let auth = self
            .token
            .as_ref()
            .and_then(|t| t.lock().ok().and_then(|v| v.clone()))
            .or(auth);
        if let Some(auth) = auth {
            request = request.bearer_auth(auth);
        }
        for (name, value) in headers {
            if matches!(
                name.as_str(),
                "host"
                    | "content-length"
                    | "mcp-session-id"
                    | "accept"
                    | "content-type"
                    | "last-event-id"
            ) {
                return Err(McpError::Endpoint);
            }
            request = request.header(name, value);
        }
        Ok(request)
    }
    fn sse(
        &self,
        response: reqwest::Response,
        limit: usize,
    ) -> BoxStream<'static, std::result::Result<Sse, SseError>> {
        // Bound the complete response stream before the SSE parser allocates.
        // This conservative response budget also bounds every individual event.
        let bytes = futures::stream::try_unfold(
            (response, 0usize),
            move |(mut response, consumed)| async move {
                match response.chunk().await.map_err(|_| McpError::Transport)? {
                    Some(chunk) if chunk.len() <= limit.saturating_sub(consumed) => {
                        let next = consumed + chunk.len();
                        Ok(Some((chunk, (response, next))))
                    }
                    Some(_) => Err(McpError::Limit),
                    None => Ok(None),
                }
            },
        );
        SseStream::from_bytes_stream(bytes).boxed()
    }
}

pub(crate) fn config(uri: &str) -> StreamableHttpClientTransportConfig {
    let mut config = StreamableHttpClientTransportConfig::with_uri(uri.to_owned())
        .reinit_on_expired_session(false)
        .max_sse_event_size(MESSAGE_BYTES)
        .max_concurrent_requests(4);
    config.retry_config = Arc::new(NeverRetry::default());
    config
}

impl StreamableHttpClient for BoundedHttpClient {
    type Error = McpError;
    async fn post_message(
        &self,
        uri: Arc<str>,
        message: ClientJsonRpcMessage,
        session: Option<Arc<str>>,
        auth: Option<String>,
        headers: HashMap<HeaderName, HeaderValue>,
    ) -> HttpResult<StreamableHttpPostResponse> {
        self.post_message_with_max_sse_event_size(uri, message, session, auth, headers, self.limit)
            .await
    }
    async fn post_message_with_max_sse_event_size(
        &self,
        uri: Arc<str>,
        message: ClientJsonRpcMessage,
        session: Option<Arc<str>>,
        auth: Option<String>,
        headers: HashMap<HeaderName, HeaderValue>,
        max_sse_event_size: usize,
    ) -> HttpResult<StreamableHttpPostResponse> {
        let attached = session.is_some();
        let discover = matches!(&message, ClientJsonRpcMessage::Request(request) if matches!(&request.request, rmcp::model::ClientRequest::DiscoverRequest(_)));
        let request = self
            .request(reqwest::Method::POST, &uri, session, auth, headers)
            .map_err(StreamableHttpError::Client)?;
        let payload = serde_json::to_vec(&message)?;
        if payload.len() > self.limit {
            return Err(StreamableHttpError::Client(McpError::Limit));
        }
        let response = request
            .header("content-type", "application/json")
            .body(payload)
            .send()
            .await
            .map_err(|_| StreamableHttpError::Client(McpError::Transport))?;
        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND && attached {
            return Err(StreamableHttpError::SessionExpired);
        }
        if matches!(status.as_u16(), 202 | 204) {
            return Ok(StreamableHttpPostResponse::Accepted);
        }
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|s| s.to_str().ok())
            .unwrap_or("")
            .to_owned();
        let session = response
            .headers()
            .get("mcp-session-id")
            .and_then(|s| s.to_str().ok())
            .filter(|s| s.len() <= 256)
            .map(str::to_owned);
        if status.is_success() && content_type.starts_with("text/event-stream") {
            return Ok(StreamableHttpPostResponse::Sse(
                self.sse(response, self.limit.min(max_sse_event_size)),
                session,
            ));
        }
        let bytes = bounded::body(response, self.limit)
            .await
            .map_err(StreamableHttpError::Client)?;
        // Retain SDK lifecycle negotiation without parsing any production RPC by hand.
        if discover
            && !attached
            && status.is_client_error()
            && !matches!(status.as_u16(), 401 | 403)
        {
            let error = serde_json::from_slice::<ServerJsonRpcMessage>(&bytes).ok();
            if let Some(ServerJsonRpcMessage::Error(error)) = error {
                return Ok(StreamableHttpPostResponse::Json(
                    ServerJsonRpcMessage::error(
                        error.error,
                        match message {
                            ClientJsonRpcMessage::Request(r) => Some(r.id),
                            _ => None,
                        },
                    ),
                    None,
                ));
            }
            return Err(StreamableHttpError::Client(McpError::Protocol));
        }
        if !status.is_success() {
            return Err(StreamableHttpError::Client(McpError::Transport));
        }
        if !content_type.starts_with("application/json") {
            return Err(StreamableHttpError::Client(McpError::Protocol));
        }
        let message = serde_json::from_slice(&bytes)
            .map_err(|_| StreamableHttpError::Client(McpError::Protocol))?;
        Ok(StreamableHttpPostResponse::Json(message, session))
    }
    async fn delete_session(
        &self,
        uri: Arc<str>,
        session: Arc<str>,
        auth: Option<String>,
        headers: HashMap<HeaderName, HeaderValue>,
    ) -> HttpResult<()> {
        let response = self
            .request(reqwest::Method::DELETE, &uri, Some(session), auth, headers)
            .map_err(StreamableHttpError::Client)?
            .send()
            .await
            .map_err(|_| StreamableHttpError::Client(McpError::Transport))?;
        if response.status().is_success() || response.status().as_u16() == 405 {
            Ok(())
        } else {
            Err(StreamableHttpError::Client(McpError::Transport))
        }
    }
    async fn get_stream(
        &self,
        uri: Arc<str>,
        session: Option<Arc<str>>,
        last_event_id: Option<String>,
        auth: Option<String>,
        headers: HashMap<HeaderName, HeaderValue>,
    ) -> HttpResult<BoxStream<'static, std::result::Result<Sse, SseError>>> {
        self.get_stream_with_max_sse_event_size(
            uri,
            session,
            last_event_id,
            auth,
            headers,
            self.limit,
        )
        .await
    }
    async fn get_stream_with_max_sse_event_size(
        &self,
        uri: Arc<str>,
        session: Option<Arc<str>>,
        last_event_id: Option<String>,
        auth: Option<String>,
        headers: HashMap<HeaderName, HeaderValue>,
        max_sse_event_size: usize,
    ) -> HttpResult<BoxStream<'static, std::result::Result<Sse, SseError>>> {
        let mut request = self
            .request(reqwest::Method::GET, &uri, session, auth, headers)
            .map_err(StreamableHttpError::Client)?;
        if let Some(id) = last_event_id {
            if id.len() > 256 {
                return Err(StreamableHttpError::Client(McpError::Limit));
            }
            request = request.header("last-event-id", id);
        }
        let response = request
            .send()
            .await
            .map_err(|_| StreamableHttpError::Client(McpError::Transport))?;
        if response.status().as_u16() == 405 {
            return Err(StreamableHttpError::ServerDoesNotSupportSse);
        }
        if !response.status().is_success() {
            return Err(StreamableHttpError::Client(McpError::Transport));
        }
        if !response
            .headers()
            .get("content-type")
            .is_some_and(|s| s.as_bytes().starts_with(b"text/event-stream"))
        {
            return Err(StreamableHttpError::Client(McpError::Protocol));
        }
        Ok(self.sse(response, self.limit.min(max_sse_event_size)))
    }
}
impl OAuthHttpClient for BoundedHttpClient {
    fn execute(&self, request: OAuthHttpRequest) -> OAuthHttpClientFuture<'_> {
        Box::pin(async move {
            let (parts, payload) = request.request.into_parts();
            if payload.len() > self.limit {
                return Err(Box::new(McpError::Limit) as _);
            }
            let url = self.endpoint(&parts.uri.to_string())?;
            let response = self
                .client
                .request(parts.method, url)
                .headers(parts.headers)
                .body(payload)
                .send()
                .await
                .map_err(|_| McpError::Transport)?;
            // Redirects are always returned; no credential or issuer forwarding.
            let status = response.status();
            let headers = response.headers().clone();
            let bytes = bounded::body(response, self.limit).await?;
            let mut response = http::Response::new(bytes);
            *response.status_mut() = status;
            *response.headers_mut() = headers;
            Ok(response)
        })
    }
}
