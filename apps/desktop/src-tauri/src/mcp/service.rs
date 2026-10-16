//! Window/store scoped native owner. Reservations precede IO; original receipts
//! survive retirement, while prepared authority is retired before mutation.
use super::{
    MESSAGE_BYTES, McpError, REQUEST_TIMEOUT, Result,
    catalogue::{Catalogue, CatalogueSource, digest, id},
    oauth::{self, VaultCredentials},
    process::OwnedProcess,
    protocol::*,
    transport,
    vault::{CredentialVault, NativeSecretStore, SecretStore},
};
use crate::full_product_store::protocol::Session;
use rmcp::{
    ClientServiceExt, Peer, RoleClient, ServiceError,
    model::*,
    service::{ClientLifecycleMode, RunningService},
    transport::{StreamableHttpClientTransport, async_rw::AsyncRwTransport},
};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};
use tokio::sync::{Mutex as AsyncMutex, Notify};
use tokio_util::sync::CancellationToken;
const RECORDS: usize = 256;
const AUTHORITIES: usize = 256;
type Open = Arc<dyn Fn(&str) -> Result<()> + Send + Sync>;
fn fresh(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4())
}
fn owned_bytes<T: serde::Serialize>(v: &T) -> Result<Vec<u8>> {
    serde_json::to_vec(&serde_json::to_value(v).map_err(|_| McpError::Protocol)?)
        .map_err(|_| McpError::Protocol)
}
fn fingerprint<T: serde::Serialize>(v: &T) -> Result<String> {
    Ok(digest(&owned_bytes(v)?))
}
fn code(e: McpError) -> &'static str {
    match e {
        McpError::Limit => "limit",
        McpError::AuthRequired => "auth_required",
        McpError::Deadline => "timeout",
        McpError::VaultUnavailable => "vault_unavailable",
        McpError::VaultUnknown => "vault_unknown",
        McpError::VaultConflict => "conflict",
        McpError::DrainUnknown => "draining",
        _ => "invalid",
    }
}
struct Server {
    vault: Arc<CredentialVault>,
    epoch: Arc<AtomicU64>,
    fence: Arc<Mutex<()>>,
    principal: String,
}
#[derive(Clone)]
struct Candidate {
    server: String,
    reference: PrivateRef,
    config: PrivateConfig,
}
struct Receipt {
    fingerprint: String,
    reply: Mutex<Option<Reply>>,
    notify: Notify,
}
impl Receipt {
    fn pending(fingerprint: String) -> Self {
        Self {
            fingerprint,
            reply: Mutex::new(None),
            notify: Notify::new(),
        }
    }
    fn finish(&self, r: Reply) {
        *self.reply.lock().unwrap() = Some(r);
        self.notify.notify_waiters()
    }
    fn read(&self) -> Option<Reply> {
        self.reply.lock().unwrap().clone()
    }
}
struct Invocation {
    identity: Identity,
    arguments_digest: String,
    receipt: Arc<Receipt>,
    cancel: CancellationToken,
    dispatched: std::sync::atomic::AtomicBool,
}
struct State {
    servers: HashMap<String, Server>,
    candidates: HashMap<String, Candidate>,
    operations: HashMap<String, Arc<Receipt>>,
    operation_types: HashMap<String, String>,
    connections: HashMap<String, Arc<Connection>>,
    retired: HashMap<String, Arc<Connection>>,
    pending_connect: HashMap<String, String>,
    pending_login: HashMap<String, String>,
    authorities: HashMap<String, Authority>,
    invocations: HashMap<String, Arc<Invocation>>,
    logins: HashMap<String, oauth::Login>,
    disposed: bool,
    quiescing: bool,
}
impl Default for State {
    fn default() -> Self {
        Self {
            servers: HashMap::new(),
            candidates: HashMap::new(),
            operations: HashMap::new(),
            operation_types: HashMap::new(),
            connections: HashMap::new(),
            retired: HashMap::new(),
            pending_connect: HashMap::new(),
            pending_login: HashMap::new(),
            authorities: HashMap::new(),
            invocations: HashMap::new(),
            logins: HashMap::new(),
            disposed: false,
            quiescing: false,
        }
    }
}
pub(crate) struct Service {
    pub host_session_id: String,
    session: Session,
    source: CatalogueSource,
    store: Arc<dyn SecretStore>,
    app: String,
    profile: String,
    open: Open,
    state: Mutex<State>,
    tasks: tokio_util::task::TaskTracker,
    admission: Arc<std::sync::atomic::AtomicBool>,
}
struct Connection {
    binding: Binding,
    reference: PrivateRef,
    peer: Peer<RoleClient>,
    runner: AsyncMutex<Option<RunningService<RoleClient, ()>>>,
    process: AsyncMutex<Option<OwnedProcess>>,
    drain: AsyncMutex<Option<tokio::task::JoinHandle<bool>>>,
    drained: std::sync::atomic::AtomicBool,
    tools: HashSet<String>,
    resources: HashMap<String, String>,
    discovery: Value,
    config: PrivateConfig,
    credentials: Option<VaultCredentials>,
    principal_identity: Option<String>,
    token: Arc<Mutex<Option<String>>>,
    dispatch: AsyncMutex<()>,
}
impl Connection {
    async fn close(self: &Arc<Self>) -> bool {
        if self.drained.load(Ordering::Acquire) {
            return true;
        }
        let mut slot = self.drain.lock().await;
        if slot.is_none() {
            let owner = self.clone();
            *slot = Some(tokio::spawn(async move {
                let mut runner = owner.runner.lock().await.take();
                if let Some(r) = runner.as_mut() {
                    let _ = r.close().await;
                }
                let ok = if let Some(p) = owner.process.lock().await.as_mut() {
                    p.stop().await.is_ok()
                } else {
                    true
                };
                if ok {
                    owner.drained.store(true, Ordering::Release)
                }
                ok
            }));
        }
        match tokio::time::timeout(Duration::from_secs(5), slot.as_mut().unwrap()).await {
            Ok(Ok(true)) => {
                slot.take();
                true
            }
            Ok(_) => {
                slot.take();
                false
            }
            Err(_) => false,
        }
    }
}
impl Service {
    pub fn native(
        session: Session,
        source: CatalogueSource,
        app: String,
        profile: String,
        open: Open,
        admission: Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<Arc<Self>> {
        let mut service = Self::new(
            session,
            source,
            Arc::new(NativeSecretStore::open()?),
            app,
            profile,
            open,
        )?;
        Arc::get_mut(&mut service)
            .expect("Fresh MCP native owner")
            .admission = admission;
        Ok(service)
    }
    pub(crate) fn new(
        session: Session,
        source: CatalogueSource,
        store: Arc<dyn SecretStore>,
        app: String,
        profile: String,
        open: Open,
    ) -> Result<Arc<Self>> {
        if !id(&session.workspace_id)
            || app.is_empty()
            || app.len() > 160
            || !app
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b':' | b'_' | b'-'))
            || !id(&profile)
        {
            return Err(McpError::Protocol);
        }
        Ok(Arc::new(Self {
            host_session_id: fresh("host"),
            session,
            source,
            store,
            app,
            profile,
            open,
            state: Mutex::new(State::default()),
            tasks: tokio_util::task::TaskTracker::new(),
            admission: Arc::new(std::sync::atomic::AtomicBool::new(true)),
        }))
    }
    pub fn matches_session(&self, s: &Session) -> bool {
        s.version == self.session.version
            && s.session == self.session.session
            && s.workspace_id == self.session.workspace_id
            && s.generation == self.session.generation
    }
    fn catalogue(&self) -> Result<Catalogue> {
        (self.source)(&self.session)
    }
    fn server(
        &self,
        server: &str,
    ) -> Result<(Arc<CredentialVault>, Arc<AtomicU64>, Arc<Mutex<()>>, String)> {
        if !id(server) {
            return Err(McpError::Protocol);
        }
        let mut s = self.state.lock().unwrap();
        if s.disposed {
            return Err(McpError::VaultConflict);
        }
        if !s.servers.contains_key(server) {
            if s.servers.len() >= 16 {
                return Err(McpError::Limit);
            }
            s.servers.insert(
                server.into(),
                Server {
                    vault: Arc::new(CredentialVault::new(
                        self.store.clone(),
                        &self.app,
                        &self.profile,
                        &self.session.workspace_id,
                        server,
                    )?),
                    epoch: Arc::new(AtomicU64::new(0)),
                    fence: Arc::new(Mutex::new(())),
                    principal: fresh("principal"),
                },
            );
        }
        let v = &s.servers[server];
        Ok((
            v.vault.clone(),
            v.epoch.clone(),
            v.fence.clone(),
            v.principal.clone(),
        ))
    }
    fn credentials(&self, server: &str, reference: &PrivateRef) -> Result<VaultCredentials> {
        let (vault, epoch, fence, _) = self.server(server)?;
        let expected = epoch.load(Ordering::Acquire);
        Ok(VaultCredentials {
            vault,
            slot: reference.revision_id.clone(),
            current: Arc::new(move || epoch.load(Ordering::Acquire) == expected),
            fence,
        })
    }
    fn read_config(&self, server: &str, reference: &PrivateRef) -> Result<PrivateConfig> {
        if reference.kind != "native_vault" || reference.owner_id != self.owner(server) {
            return Err(McpError::VaultConflict);
        }
        let (vault, _, _, _) = self.server(server)?;
        let (_, bytes) = vault
            .read(&reference.revision_id)?
            .ok_or(McpError::VaultUnavailable)?;
        let c: PrivateConfig =
            serde_json::from_slice(&bytes).map_err(|_| McpError::VaultCorrupt)?;
        validate_config(&c)?;
        Ok(c)
    }
    fn owner(&self, server: &str) -> String {
        format!(
            "owner_{}",
            digest(
                format!(
                    "{}:{}:{}:{server}",
                    self.app, self.profile, self.session.workspace_id
                )
                .as_bytes()
            )
        )
    }
    fn guard(&self, b: &Binding, reference: &PrivateRef) -> Result<()> {
        if b.host_session_id != self.host_session_id {
            return Err(McpError::VaultConflict);
        }
        let c = self.catalogue()?;
        c.current(&b.server_id, b.config_revision, reference)?;
        let s = self.state.lock().unwrap();
        if s.disposed
            || !s
                .connections
                .get(&b.server_id)
                .is_some_and(|v| v.binding == *b)
        {
            return Err(McpError::VaultConflict);
        }
        Ok(())
    }
    fn retire(&self, server: &str) {
        let connections = {
            let mut s = self.state.lock().unwrap();
            if let Some(v) = s.servers.get_mut(server) {
                let _fence = v.fence.lock().unwrap();
                v.epoch.fetch_add(1, Ordering::AcqRel);
                v.principal = fresh("principal");
            }
            s.authorities.retain(|_, a| a.binding.server_id != server);
            for login in s.logins.values() {
                if login.server_id == server {
                    login.cancel.cancel()
                }
            }
            let connection = s.connections.remove(server);
            if let Some(c) = connection.as_ref() {
                s.retired
                    .insert(c.binding.registration_id.clone(), c.clone());
            }
            connection
        };
        if let Some(c) = connections {
            tokio::spawn(async move {
                c.close().await;
            });
        }
    }
    async fn drain_server(&self, server: &str) -> bool {
        let (connections, pending) = {
            let s = self.state.lock().unwrap();
            (
                s.retired
                    .values()
                    .filter(|c| c.binding.server_id == server)
                    .cloned()
                    .collect::<Vec<_>>(),
                s.pending_connect
                    .values()
                    .chain(s.pending_login.values())
                    .any(|v| v == server)
                    || s.logins
                        .values()
                        .any(|login| login.server_id == server && !login.task.is_finished()),
            )
        };
        let mut drained = !pending;
        for c in connections {
            drained &= c.close().await;
        }
        drained
    }
    fn close_admission(&self) -> Vec<String> {
        let mut state = self.state.lock().unwrap();
        // Close admission and capture every existing owner at one boundary.
        // Retirement may then wait for each credential fence outside this lock.
        state.disposed = true;
        state.servers.keys().cloned().collect()
    }
    pub fn invalidate(&self) {
        for server in self.close_admission() {
            self.retire(&server)
        }
    }
    /// Reject new effects without retiring the authority required by original
    /// Stop/status and late-result publication during the cooperative grace.
    pub(crate) fn quiesce(&self) {
        let mut state = self.state.lock().unwrap();
        state.quiescing = true;
        for invocation in state.invocations.values() {
            invocation.cancel.cancel();
        }
    }
    pub(crate) async fn shutdown(&self) -> bool {
        self.invalidate();
        self.tasks.close();
        // Tasks remain the original connect/login/invoke bodies, including any
        // spawned child/process cleanup. Do not reconstruct wait from booleans.
        let connections = {
            let state = self.state.lock().unwrap();
            state
                .connections
                .values()
                .chain(state.retired.values())
                .cloned()
                .collect::<Vec<_>>()
        };
        let close = async {
            for connection in connections {
                while !connection.close().await {
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            }
        };
        tokio::join!(self.tasks.wait(), close);
        // A pending original connect may retire a discovered connection while
        // shutting down. Task settlement precedes this final complete capture.
        let connections = {
            let state = self.state.lock().unwrap();
            state
                .connections
                .values()
                .chain(state.retired.values())
                .cloned()
                .collect::<Vec<_>>()
        };
        for connection in connections {
            if !connection.close().await {
                return false;
            }
        }
        true
    }
    fn reserve(&self, key: &str, fp: String) -> Result<(Arc<Receipt>, bool)> {
        let mut s = self.state.lock().unwrap();
        let (kind, op) = key.split_once(':').ok_or(McpError::Protocol)?;
        if s.operation_types.get(op).is_some_and(|old| old != kind) {
            return Err(McpError::VaultConflict);
        }
        if let Some(r) = s.operations.get(key) {
            if r.fingerprint != fp {
                return Err(McpError::VaultConflict);
            }
            return Ok((r.clone(), false));
        }
        if s.disposed || s.quiescing || !self.admission.load(Ordering::SeqCst) {
            return Err(McpError::VaultConflict);
        }
        if s.operations.len() >= RECORDS {
            return Err(McpError::Limit);
        }
        let r = Arc::new(Receipt::pending(fp));
        s.operation_types.insert(op.into(), kind.into());
        s.operations.insert(key.into(), r.clone());
        Ok((r, true))
    }
    async fn wait(&self, op: &str, r: Arc<Receipt>) -> Reply {
        let notified = r.notify.notified();
        if let Some(v) = r.read() {
            return v;
        }
        let _ = tokio::time::timeout(REQUEST_TIMEOUT, notified).await;
        r.read()
            .unwrap_or_else(|| Reply::error(op, &self.host_session_id, "reply_lost"))
    }
    pub async fn request(self: &Arc<Self>, e: Envelope) -> Reply {
        let op = e.operation_id.clone();
        let result = self.perform(e).await;
        result.unwrap_or_else(|error| Reply {
            status: "notStarted".into(),
            ..Reply::error(&op, &self.host_session_id, code(error))
        })
    }
    async fn perform(self: &Arc<Self>, e: Envelope) -> Result<Reply> {
        let op = &e.operation_id;
        if matches!(&e.action,Action::Invoke{identity,..}|Action::Status{identity}|Action::Stop{identity} if identity.operation_id!=*op)
        {
            return Err(McpError::Protocol);
        }
        let host = &self.host_session_id;
        if e.version != 1 || !id(op) || !self.matches_session(&e.session) {
            return Err(McpError::Protocol);
        }
        self.catalogue()?; // actor validates the live store session even for status
        if !matches!(e.action, Action::Capabilities {}) && e.host_session_id.as_ref() != Some(host)
        {
            return Err(McpError::VaultConflict);
        }
        if self.state.lock().unwrap().disposed
            && !matches!(
                e.action,
                Action::Status { .. } | Action::Stop { .. } | Action::Dispose {}
            )
        {
            return Err(McpError::VaultConflict);
        }
        if self.state.lock().unwrap().quiescing
            && matches!(
                e.action,
                Action::PrivatePrepare { .. }
                    | Action::Connect { .. }
                    | Action::Prepare { .. }
                    | Action::Invoke { .. }
                    | Action::OauthBegin { .. }
            )
        {
            return Err(McpError::VaultConflict);
        }
        let stop = matches!(&e.action, Action::Stop { .. });
        match e.action {
            Action::Capabilities {} => Ok(Reply::new(
                op,
                host,
                "completed",
                json!({"host":"desktop","stdio":true,"streamableHttp":true,"oauth":true,"rememberedCredentials":true}),
            )),
            Action::PrivatePrepare {
                server_id,
                catalogue_revision,
                expected_config_revision,
                config,
            } => {
                validate_config(&config)?;
                let fp = fingerprint(&(
                    &server_id,
                    catalogue_revision,
                    expected_config_revision,
                    &config,
                ))?;
                let key = format!("private:{op}");
                let (r, new) = self.reserve(&key, fp.clone())?;
                if !new {
                    return Ok(self.wait(op, r).await);
                }
                let result = (|| {
                    let c = self.catalogue()?;
                    if c.revision != catalogue_revision
                        || c.entries
                            .iter()
                            .find(|v| v.server_id == server_id)
                            .map_or(0, |v| v.config_revision)
                            != expected_config_revision
                    {
                        return Err(McpError::VaultConflict);
                    }
                    let (vault, _, _, _) = self.server(&server_id)?;
                    let reference = PrivateRef {
                        kind: "native_vault".into(),
                        owner_id: self.owner(&server_id),
                        revision_id: format!("private_{}", digest(op.as_bytes())),
                    };
                    let bytes = owned_bytes(&config)?;
                    self.state.lock().unwrap().candidates.insert(
                        op.into(),
                        Candidate {
                            server: server_id,
                            reference: reference.clone(),
                            config,
                        },
                    );
                    vault.prepare(op, &reference.revision_id, &bytes)?;
                    Ok(Reply::new(
                        op,
                        host,
                        "prepared",
                        json!({"reference":reference}),
                    ))
                })();
                let reply = result.unwrap_or_else(|err| Reply::error(op, host, code(err)));
                r.finish(reply.clone());
                Ok(reply)
            }
            Action::PrivateStatus { server_id } => {
                let candidate = self.state.lock().unwrap().candidates.get(op).cloned();
                if let Some(c) = candidate {
                    if c.server != server_id {
                        return Err(McpError::VaultConflict);
                    }
                    let (vault, _, _, _) = self.server(&server_id)?;
                    let payload = owned_bytes(&c.config)?;
                    match vault.prepare(op, &c.reference.revision_id, &payload) {
                        Ok(_) => Ok(Reply::new(
                            op,
                            host,
                            "prepared",
                            json!({"reference":c.reference}),
                        )),
                        Err(err) => Ok(Reply::error(op, host, code(err))),
                    }
                } else {
                    Ok(Reply::error(op, host, "vault_unknown"))
                }
            }
            Action::PrivateConfirm {
                server_id,
                reference,
                catalogue_fingerprint,
            } => {
                let c = self.catalogue()?;
                let s = self.state.lock().unwrap();
                let candidate = s.candidates.get(op).ok_or(McpError::VaultUnknown)?;
                if candidate.server != server_id
                    || candidate.reference != reference
                    || !c.receipts.iter().any(|r| {
                        r.operation_id == *op
                            && r.server_id == server_id
                            && r.kind == "save"
                            && r.fingerprint == catalogue_fingerprint
                            && r.published_private_revision.as_ref() == Some(&reference)
                    })
                    || !c
                        .entries
                        .iter()
                        .any(|v| v.server_id == server_id && v.private_revision == reference)
                {
                    return Err(McpError::VaultConflict);
                }
                Ok(Reply::new(op, host, "completed", json!({"confirmed":true})))
            }
            Action::PrivateDiscard {
                server_id,
                reference,
            } => {
                let c = self.catalogue()?;
                if c.entries.iter().any(|v| v.private_revision == reference) {
                    return Err(McpError::VaultConflict);
                }
                if reference.owner_id != self.owner(&server_id) {
                    return Err(McpError::VaultConflict);
                }
                let (vault, _, _, _) = self.server(&server_id)?;
                // Serialize with publication/refresh and re-read the actual store
                // immediately before collecting only this unreferenced owner slot.
                let (_, _, fence, _) = self.server(&server_id)?;
                let _fence = fence.lock().map_err(|_| McpError::VaultUnavailable)?;
                if self
                    .catalogue()?
                    .entries
                    .iter()
                    .any(|v| v.private_revision == reference)
                {
                    return Err(McpError::VaultConflict);
                }
                vault.clear_slot(&reference.revision_id)?;
                if let Some((r, _)) = vault.read(&reference.revision_id)? {
                    vault.collect_unreferenced(&reference.revision_id, &r)?
                }
                Ok(Reply::new(op, host, "completed", json!({})))
            }
            Action::Retire {
                server_id,
                expected_config_revision,
            } => {
                if let Some(expected) = expected_config_revision {
                    let c = self.catalogue()?;
                    if c.entries
                        .iter()
                        .find(|v| v.server_id == server_id)
                        .map_or(0, |v| v.config_revision)
                        != expected
                    {
                        return Err(McpError::VaultConflict);
                    }
                }
                self.retire(&server_id);
                let drained = self.drain_server(&server_id).await;
                Ok(Reply::new(
                    op,
                    host,
                    if drained { "drained" } else { "draining" },
                    json!({}),
                ))
            }
            Action::Connect {
                server_id,
                config_revision,
                private_revision,
            } => {
                let fp = fingerprint(&(&server_id, config_revision, &private_revision))?;
                let (r, new) = self.reserve(&format!("connect:{op}"), fp)?;
                if new {
                    let (_, epoch, _, _) = self.server(&server_id)?;
                    let expected = epoch.load(Ordering::Acquire);
                    let task_token;
                    {
                        let mut s = self.state.lock().unwrap();
                        if s.disposed
                            || s.quiescing
                            || !self.admission.load(Ordering::SeqCst)
                            || s.pending_connect.len()
                                + s.connections.len()
                                + s.retired
                                    .values()
                                    .filter(|c| !c.drained.load(Ordering::Acquire))
                                    .count()
                                >= 8
                        {
                            let reply = Reply {
                                status: "notStarted".into(),
                                ..Reply::error(
                                    op,
                                    host,
                                    if s.disposed { "retired" } else { "limit" },
                                )
                            };
                            r.finish(reply.clone());
                            return Ok(reply);
                        }
                        s.pending_connect.insert(op.clone(), server_id.clone());
                        task_token = self.tasks.token();
                    }
                    let owner = self.clone();
                    let op = op.clone();
                    let receipt = r.clone();
                    self.tasks.spawn(async move {
                        let _task_token = task_token;
                        let result = owner
                            .connect(&server_id, config_revision, private_revision, expected)
                            .await;
                        owner.state.lock().unwrap().pending_connect.remove(&op);
                        let reply = match result {
                            Ok(c) => Reply::new(
                                &op,
                                &owner.host_session_id,
                                "connected",
                                json!({"binding":c.binding,"discovery":c.discovery}),
                            ),
                            Err(err) => Reply::error(&op, &owner.host_session_id, code(err)),
                        };
                        receipt.finish(reply);
                    });
                }
                Ok(self.wait(op, r).await)
            }
            Action::Disconnect { binding } => {
                let conn = {
                    let s = self.state.lock().unwrap();
                    s.connections
                        .get(&binding.server_id)
                        .filter(|c| c.binding == binding)
                        .or_else(|| {
                            s.retired
                                .get(&binding.registration_id)
                                .filter(|c| c.binding == binding)
                        })
                        .cloned()
                };
                if let Some(c) = conn {
                    if self
                        .state
                        .lock()
                        .unwrap()
                        .connections
                        .get(&binding.server_id)
                        .is_some_and(|v| v.binding == binding)
                    {
                        self.retire(&binding.server_id);
                    }
                    let drained = c.close().await;
                    Ok(Reply::new(
                        op,
                        host,
                        if drained { "drained" } else { "draining" },
                        json!({}),
                    ))
                } else {
                    Ok(Reply::new(op, host, "drained", json!({})))
                }
            }
            Action::Prepare {
                binding,
                scope,
                target,
                arguments,
            } => {
                if ![&scope.run_id, &scope.call_id, &scope.scope_id]
                    .into_iter()
                    .all(|v| id(v))
                {
                    return Err(McpError::Protocol);
                }
                let conn = self.connection(&binding)?;
                self.guard(&binding, &conn.reference)?;
                check_target(&conn, &target, &arguments)?;
                let authority = Authority {
                    authority_id: fresh("authority"),
                    binding,
                    scope,
                    target,
                    arguments_digest: argument_digest(&arguments)?,
                };
                let mut s = self.state.lock().unwrap();
                if s.disposed
                    || s.quiescing
                    || !self.admission.load(Ordering::SeqCst)
                    || !s
                        .connections
                        .get(&authority.binding.server_id)
                        .is_some_and(|c| c.binding == authority.binding)
                {
                    return Err(McpError::VaultConflict);
                }
                if s.authorities.len() >= AUTHORITIES {
                    return Err(McpError::Limit);
                }
                s.authorities
                    .insert(authority.authority_id.clone(), authority.clone());
                Ok(Reply::new(
                    op,
                    host,
                    "prepared",
                    serde_json::to_value(authority).map_err(|_| McpError::Protocol)?,
                ))
            }
            Action::Invoke {
                identity,
                arguments,
            } => {
                let r = self.invoke(identity, arguments)?;
                Ok(self.wait(op, r).await)
            }
            Action::Status { identity } | Action::Stop { identity } => {
                let s = self.state.lock().unwrap();
                let v = s
                    .invocations
                    .get(&identity.operation_id)
                    .ok_or(McpError::VaultUnknown)?;
                if v.identity != identity {
                    return Err(McpError::VaultConflict);
                }
                if stop {
                    v.cancel.cancel()
                }
                Ok(v.receipt.read().unwrap_or_else(|| {
                    Reply::error(op, host, if stop { "stopped" } else { "reply_lost" })
                }))
            }
            Action::OauthBegin {
                server_id,
                config_revision,
                private_revision,
            } => {
                let fp = fingerprint(&(&server_id, config_revision, &private_revision))?;
                let (r, new) = self.reserve(&format!("login:{op}"), fp)?;
                if new {
                    self.server(&server_id)?;
                    self.retire(&server_id);
                    let credentials = self.credentials(&server_id, &private_revision)?;
                    let task_token;
                    {
                        let mut s = self.state.lock().unwrap();
                        if s.disposed
                            || s.quiescing
                            || !self.admission.load(Ordering::SeqCst)
                            || s.pending_login.len() + s.logins.len() >= 16
                        {
                            let reply = Reply {
                                status: "notStarted".into(),
                                ..Reply::error(
                                    op,
                                    host,
                                    if s.disposed { "retired" } else { "limit" },
                                )
                            };
                            r.finish(reply.clone());
                            return Ok(reply);
                        }
                        s.pending_login.insert(op.clone(), server_id.clone());
                        task_token = self.tasks.token();
                    }
                    let owner = self.clone();
                    let op = op.clone();
                    let receipt = r.clone();
                    self.tasks.spawn(async move {
                        let _task_token = task_token;
                        let result = owner
                            .login(&server_id, config_revision, private_revision, credentials)
                            .await;
                        owner.state.lock().unwrap().pending_login.remove(&op);
                        receipt.finish(match result {
                            Ok((attempt, redirect)) => Reply::new(
                                &op,
                                &owner.host_session_id,
                                "prepared",
                                json!({"attemptId":attempt,"redirectDisplay":redirect}),
                            ),
                            Err(err) => Reply::error(&op, &owner.host_session_id, code(err)),
                        });
                    });
                }
                Ok(self.wait(op, r).await)
            }
            Action::OauthStatus { attempt_id } => {
                let s = self.state.lock().unwrap();
                let l = s.logins.get(&attempt_id).ok_or(McpError::VaultUnknown)?;
                let state = l.state.lock().unwrap().clone();
                Ok(Reply::new(
                    op,
                    host,
                    "prepared",
                    json!({"attemptId":attempt_id,"state":state}),
                ))
            }
            Action::OauthCancel { attempt_id } => {
                let server = {
                    let s = self.state.lock().unwrap();
                    let l = s.logins.get(&attempt_id).ok_or(McpError::VaultUnknown)?;
                    l.cancel.cancel();
                    l.server_id.clone()
                };
                self.retire(&server);
                Ok(Reply::new(op, host, "canceled", json!({})))
            }
            Action::Dispose {} => {
                let connections = {
                    let s = self.state.lock().unwrap();
                    s.connections
                        .values()
                        .chain(s.retired.values())
                        .cloned()
                        .collect::<Vec<_>>()
                };
                self.invalidate();
                let mut drained = {
                    let s = self.state.lock().unwrap();
                    s.pending_connect.is_empty()
                        && s.pending_login.is_empty()
                        && s.logins.values().all(|login| login.task.is_finished())
                };
                for c in connections {
                    drained &= c.close().await;
                }
                Ok(Reply::new(
                    op,
                    host,
                    if drained { "drained" } else { "draining" },
                    json!({}),
                ))
            }
        }
    }
    fn connection(&self, b: &Binding) -> Result<Arc<Connection>> {
        self.state
            .lock()
            .unwrap()
            .connections
            .get(&b.server_id)
            .filter(|c| c.binding == *b)
            .cloned()
            .ok_or(McpError::VaultConflict)
    }
    async fn connect(
        self: &Arc<Self>,
        server: &str,
        revision: u64,
        reference: PrivateRef,
        expected: u64,
    ) -> Result<Arc<Connection>> {
        let catalogue = self.catalogue()?;
        let entry = catalogue.current(server, revision, &reference)?;
        let config = self.read_config(server, &reference)?;
        check_public(entry, &config)?;
        let (_, epoch, _, principal) = self.server(server)?;
        if epoch.load(Ordering::Acquire) != expected {
            return Err(McpError::VaultConflict);
        }
        {
            let s = self.state.lock().unwrap();
            if s.connections.len() >= 8 || s.connections.contains_key(server) {
                return Err(McpError::Limit);
            }
        }
        let credentials = if matches!(
            &config,
            PrivateConfig::StreamableHttp {
                auth: Auth::Oauth { .. },
                ..
            }
        ) {
            Some(self.credentials(server, &reference)?)
        } else {
            None
        };
        let token = Arc::new(Mutex::new(None));
        let mut principal_identity = None;
        if let Some(c) = credentials.clone() {
            let access = oauth::token_with_identity(&config, c).await?;
            principal_identity = Some(access.principal_identity);
            *token.lock().unwrap() = Some(access.access_token);
        }
        if epoch.load(Ordering::Acquire) != expected {
            return Err(McpError::VaultConflict);
        }
        let mut process = None;
        let runner_result: Result<RunningService<RoleClient, ()>> = async {
            Ok(match &config {
                PrivateConfig::Stdio {
                    executable,
                    args,
                    cwd,
                    environment,
                } => {
                    let (p, read, write) = OwnedProcess::spawn(
                        Path::new(executable),
                        args,
                        cwd.as_deref().map(Path::new),
                        environment,
                    )?;
                    process = Some(p);
                    tokio::time::timeout(
                        REQUEST_TIMEOUT,
                        ().serve_with_lifecycle(
                            AsyncRwTransport::new_client(read, write),
                            lifecycle(),
                        ),
                    )
                    .await
                    .map_err(|_| McpError::Deadline)?
                    .map_err(|_| McpError::Transport)?
                }
                PrivateConfig::StreamableHttp { endpoint, auth } => {
                    let mut cfg = transport::config(endpoint);
                    if let Auth::Manual { headers } = auth {
                        for (k, v) in headers {
                            cfg.custom_headers.insert(
                                http::HeaderName::from_bytes(k.as_bytes())
                                    .map_err(|_| McpError::Protocol)?,
                                http::HeaderValue::from_str(v).map_err(|_| McpError::Protocol)?,
                            );
                        }
                    }
                    let client = transport::BoundedHttpClient::new(
                        vec![reqwest::Url::parse(endpoint).map_err(|_| McpError::Endpoint)?],
                        MESSAGE_BYTES,
                    )?
                    .with_token(token.clone());
                    tokio::time::timeout(
                        REQUEST_TIMEOUT,
                        ().serve_with_lifecycle(
                            StreamableHttpClientTransport::with_client(client, cfg),
                            lifecycle(),
                        ),
                    )
                    .await
                    .map_err(|_| McpError::Deadline)?
                    .map_err(|_| McpError::Transport)?
                }
            })
        }
        .await;
        let runner = match runner_result {
            Ok(r) => r,
            Err(e) => {
                drain_process(&mut process).await;
                return Err(e);
            }
        };
        let peer = runner.peer().clone();
        let binding = Binding {
            server_id: server.into(),
            config_revision: revision,
            manifest_revision: fresh("manifest"),
            registration_id: fresh("registration"),
            host_session_id: self.host_session_id.clone(),
            principal_revision: principal,
        };
        let discovered = discover(server, &peer).await;
        let (tools, resources, discovery) = match discovered {
            Ok(v) => v,
            Err(e) => {
                let mut runner = runner;
                let _ = runner.close().await;
                drain_process(&mut process).await;
                return Err(e);
            }
        };
        let conn = Arc::new(Connection {
            binding,
            reference: reference.clone(),
            peer,
            runner: AsyncMutex::new(Some(runner)),
            process: AsyncMutex::new(process),
            drain: AsyncMutex::new(None),
            drained: std::sync::atomic::AtomicBool::new(false),
            tools,
            resources,
            discovery,
            config,
            credentials,
            principal_identity,
            token,
            dispatch: AsyncMutex::new(()),
        });
        let current = self
            .catalogue()
            .is_ok_and(|c| c.current(server, revision, &reference).is_ok());
        let publish = {
            let mut s = self.state.lock().unwrap();
            if !current
                || s.disposed
                || epoch.load(Ordering::Acquire) != expected
                || s.connections.contains_key(server)
                || s.connections.len() >= 8
            {
                false
            } else {
                s.connections.insert(server.into(), conn.clone());
                true
            }
        };
        if !publish {
            self.state
                .lock()
                .unwrap()
                .retired
                .insert(conn.binding.registration_id.clone(), conn.clone());
            conn.close().await;
            return Err(McpError::VaultConflict);
        }
        Ok(conn)
    }
    fn invoke(self: &Arc<Self>, identity: Identity, arguments: Value) -> Result<Arc<Receipt>> {
        if !id(&identity.operation_id) {
            return Err(McpError::Protocol);
        }
        let args = argument_digest(&arguments)?;
        {
            let s = self.state.lock().unwrap();
            if let Some(v) = s.invocations.get(&identity.operation_id) {
                if v.identity != identity || v.arguments_digest != args {
                    return Err(McpError::VaultConflict);
                }
                return Ok(v.receipt.clone());
            }
        }
        let conn = self.connection(&identity.authority.binding)?;
        self.guard(&identity.authority.binding, &conn.reference)?;
        check_target(&conn, &identity.authority.target, &arguments)?;
        let receipt = Arc::new(Receipt::pending(args.clone()));
        let invocation = Arc::new(Invocation {
            identity: identity.clone(),
            arguments_digest: args.clone(),
            receipt: receipt.clone(),
            cancel: CancellationToken::new(),
            dispatched: std::sync::atomic::AtomicBool::new(false),
        });
        let task_token;
        {
            let mut s = self.state.lock().unwrap();
            if let Some(v) = s.invocations.get(&identity.operation_id) {
                if v.identity != identity || v.arguments_digest != args {
                    return Err(McpError::VaultConflict);
                }
                return Ok(v.receipt.clone());
            }
            if s.disposed || s.quiescing || !self.admission.load(Ordering::SeqCst) {
                return Err(McpError::VaultConflict);
            }
            if s.operation_types
                .get(&identity.operation_id)
                .is_some_and(|kind| kind != "invoke")
            {
                return Err(McpError::VaultConflict);
            }
            if s.invocations.len() >= RECORDS {
                return Err(McpError::Limit);
            }
            if s.authorities.get(&identity.authority.authority_id) != Some(&identity.authority)
                || identity.authority.arguments_digest != args
            {
                return Err(McpError::VaultConflict);
            }
            s.authorities.remove(&identity.authority.authority_id);
            s.operation_types
                .insert(identity.operation_id.clone(), "invoke".into());
            s.invocations
                .insert(identity.operation_id.clone(), invocation.clone());
            task_token = self.tasks.token();
        }
        let owner = self.clone();
        self.tasks.spawn(async move {
            let _task_token=task_token;
            let result = async {
                let _serial = conn.dispatch.lock().await;
                if invocation.cancel.is_cancelled() {
                    return Ok(Reply::new(
                        &identity.operation_id,
                        &owner.host_session_id,
                        "notStarted",
                        json!({}),
                    ));
                }
                if let Some(creds) = conn.credentials.clone() {
                    let access = match oauth::token_with_identity(&conn.config, creds).await {
                        Ok(v) => v,
                        Err(e) => {
                            owner.retire(&conn.binding.server_id);
                            return Err(e);
                        }
                    };
                    if conn.principal_identity.as_deref() != Some(&access.principal_identity) {
                        owner.retire(&conn.binding.server_id);
                        return Err(McpError::AuthRequired);
                    }
                    *conn.token.lock().unwrap() = Some(access.access_token)
                }
                owner.guard(&identity.authority.binding, &conn.reference)?;
                if invocation.cancel.is_cancelled() {
                    return Ok(Reply::new(
                        &identity.operation_id,
                        &owner.host_session_id,
                        "notStarted",
                        json!({}),
                    ));
                }
                // This owned claim linearizes dispatch against retirement. Once admitted,
                // its original result remains observable even if retirement immediately follows.
                {
                    let s = owner.state.lock().unwrap();
                    if s.disposed || s.quiescing || !owner.admission.load(Ordering::SeqCst)
                        || !s
                            .connections
                            .get(&identity.authority.binding.server_id)
                            .is_some_and(|c| c.binding == identity.authority.binding)
                    {
                        return Ok(Reply {
                            status: "notStarted".into(),
                            ..Reply::error(
                                &identity.operation_id,
                                &owner.host_session_id,
                                "retired",
                            )
                        });
                    }
                    invocation.dispatched.store(true, Ordering::Release);
                }
                let request = match &identity.authority.target {
                    Target::Tool { raw_name } => {
                        ClientRequest::CallToolRequest(CallToolRequest::new(
                            CallToolRequestParams::new(raw_name.clone()).with_arguments(
                                arguments.as_object().ok_or(McpError::Protocol)?.clone(),
                            ),
                        ))
                    }
                    Target::Resource { handle_id } => ClientRequest::ReadResourceRequest(
                        ReadResourceRequest::new(ReadResourceRequestParams::new(
                            conn.resources
                                .get(handle_id)
                                .ok_or(McpError::Protocol)?
                                .clone(),
                        )),
                    ),
                };
                // No SDK AuthClient, no SessionExpired reinitialization, no MRTR replay.
                let mut handle = conn
                    .peer
                    .send_cancellable_request(
                        request,
                        rmcp::service::PeerRequestOptions::no_options(),
                    )
                    .await
                    .map_err(|_| McpError::Transport)?;
                let result = tokio::select! {result=&mut handle.rx=>result.map_err(|_|McpError::Transport)?,_=invocation.cancel.cancelled()=>{let _=conn.peer.notify_cancelled(CancelledNotificationParam::new(Some(handle.id.clone()),Some("User stopped operation".into()))).await;tokio::time::timeout(REQUEST_TIMEOUT,&mut handle.rx).await.map_err(|_|McpError::Deadline)?.map_err(|_|McpError::Transport)?}};
                match result {
                    Ok(ServerResult::CallToolResult(r)) => bounded_reply(
                        &identity.operation_id,
                        &owner.host_session_id,
                        serde_json::to_value(r).map_err(|_| McpError::Protocol)?,
                    ),
                    Ok(ServerResult::ReadResourceResult(r)) => bounded_reply(
                        &identity.operation_id,
                        &owner.host_session_id,
                        serde_json::to_value(r).map_err(|_| McpError::Protocol)?,
                    ),
                    Ok(_) => Ok(Reply::error(
                        &identity.operation_id,
                        &owner.host_session_id,
                        "unsupported",
                    )),
                    Err(ServiceError::McpError(_)) => Ok(Reply {
                        status: "protocolError".into(),
                        ..Reply::error(
                            &identity.operation_id,
                            &owner.host_session_id,
                            "remote_error",
                        )
                    }),
                    Err(_) => Ok(Reply::error(
                        &identity.operation_id,
                        &owner.host_session_id,
                        "reply_lost",
                    )),
                }
            };
            let reply = match tokio::time::timeout(Duration::from_secs(65), result).await {
                Ok(Ok(r)) => r,
                Ok(Err(e)) => {
                    let mut r = Reply::error(
                        &identity.operation_id,
                        &owner.host_session_id,
                        if invocation.dispatched.load(Ordering::Acquire) {
                            "reply_lost"
                        } else {
                            code(e)
                        },
                    );
                    if !invocation.dispatched.load(Ordering::Acquire) {
                        r.status = "notStarted".into()
                    }
                    r
                }
                Err(_) => {
                    Reply::error(&identity.operation_id, &owner.host_session_id, "reply_lost")
                }
            };
            invocation.receipt.finish(reply);
        });
        Ok(receipt)
    }
    async fn login(
        self: &Arc<Self>,
        server: &str,
        revision: u64,
        reference: PrivateRef,
        credentials: VaultCredentials,
    ) -> Result<(String, String)> {
        self.catalogue()?.current(server, revision, &reference)?;
        let config = self.read_config(server, &reference)?;
        let current = credentials.current.clone();
        if !current() {
            return Err(McpError::VaultConflict);
        }
        let mut login = tokio::time::timeout(
            REQUEST_TIMEOUT,
            oauth::begin_tracked(
                config,
                credentials,
                current.clone(),
                self.open.clone(),
                self.tasks.clone(),
            ),
        )
        .await
        .map_err(|_| McpError::Deadline)??;
        login.server_id = server.into();
        if !current() {
            login.cancel.cancel();
            return Err(McpError::VaultConflict);
        }
        let attempt = login.attempt_id.clone();
        let redirect = login.redirect.clone();
        self.state
            .lock()
            .unwrap()
            .logins
            .insert(attempt.clone(), login);
        Ok((attempt, redirect))
    }
}
async fn drain_process(process: &mut Option<OwnedProcess>) {
    if let Some(p) = process.as_mut() {
        while p.stop().await.is_err() {
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }
}

#[cfg(test)]
mod lifecycle_tests {
    use super::*;
    use crate::mcp::service_tests::Harness;
    #[tokio::test]
    async fn desktop_lifecycle_mcp_reserved_original_blocks_shutdown_before_spawn() {
        let h = Harness::new();
        // Same native tracker token taken while the production reservation lock
        // is held, before connect/login/invoke may release that lock and spawn.
        let token = {
            let _state = h.service.state.lock().unwrap();
            h.service.tasks.token()
        };
        h.service.quiesce();
        assert!(h.service.reserve("connect:late", "a".repeat(64)).is_err());
        let shutdown = h.service.shutdown();
        tokio::pin!(shutdown);
        assert!(
            tokio::time::timeout(Duration::from_millis(20), shutdown.as_mut())
                .await
                .is_err()
        );
        drop(token);
        assert!(shutdown.await);
    }

    #[tokio::test]
    async fn mcp_service_closes_admission_before_retiring_existing_owners() {
        let h = Harness::new();
        let reference = h
            .config(PrivateConfig::StreamableHttp {
                endpoint: "https://fixture.invalid/mcp".into(),
                auth: Auth::None,
            })
            .await;
        let credentials = h.service.credentials("server1", &reference).unwrap();
        assert!((credentials.current)());

        // Hold shutdown at the real boundary before credential retirement. New
        // owners must already be refused while an existing epoch is still live.
        let servers = h.service.close_admission();
        assert_eq!(servers, vec!["server1"]);
        assert!((credentials.current)());
        assert!(h.service.server("late_server").is_err());
        assert!(
            h.service
                .reserve("login:late_operation", "a".repeat(64))
                .is_err()
        );
        for (op, action) in [
            (
                "late_connect",
                Action::Connect {
                    server_id: "server1".into(),
                    config_revision: 1,
                    private_revision: reference.clone(),
                },
            ),
            (
                "late_login",
                Action::OauthBegin {
                    server_id: "server1".into(),
                    config_revision: 1,
                    private_revision: reference,
                },
            ),
        ] {
            assert_eq!(h.call(op, action).await.status, "notStarted");
        }
        {
            let state = h.service.state.lock().unwrap();
            assert_eq!(state.servers.len(), 1);
            assert!(state.pending_connect.is_empty());
            assert!(state.pending_login.is_empty());
            assert_eq!(state.operations.len(), 1);
        }
        for server in servers {
            h.service.retire(&server);
        }
        assert!(!(credentials.current)());
        assert_eq!(
            h.call("dispose1", Action::Dispose {}).await.status,
            "drained"
        );
    }
}

fn lifecycle() -> ClientLifecycleMode {
    ClientLifecycleMode::Auto {
        preferred_versions: vec![ProtocolVersion::V_2026_07_28],
        legacy_version: Some(ProtocolVersion::V_2025_11_25),
    }
}
fn argument_digest(value: &Value) -> Result<String> {
    let bytes = serde_json::to_vec(value).map_err(|_| McpError::Protocol)?;
    if bytes.len() > 16 * 1024 {
        return Err(McpError::Limit);
    }
    Ok(digest(&bytes))
}
fn check_target(c: &Connection, t: &Target, args: &Value) -> Result<()> {
    argument_digest(args)?;
    match t {
        Target::Tool { raw_name } if c.tools.contains(raw_name) && args.is_object() => Ok(()),
        Target::Resource { handle_id }
            if c.resources.contains_key(handle_id)
                && args.as_object().is_some_and(|o| o.is_empty()) =>
        {
            Ok(())
        }
        _ => Err(McpError::Protocol),
    }
}
fn bounded_reply(op: &str, host: &str, value: Value) -> Result<Reply> {
    if serde_json::to_vec(&value)
        .map_err(|_| McpError::Protocol)?
        .len()
        > MESSAGE_BYTES
    {
        return Err(McpError::Limit);
    }
    Ok(Reply::new(op, host, "completed", value))
}
fn validate_config(c: &PrivateConfig) -> Result<()> {
    let payload = serde_json::to_vec(c).map_err(|_| McpError::Protocol)?;
    if payload.len() > 32 * 1024 {
        return Err(McpError::Limit);
    }
    match c {
        PrivateConfig::Stdio {
            executable,
            args,
            cwd,
            environment,
        } => {
            if !Path::new(executable).is_absolute()
                || executable.contains('\0')
                || args.len() > 128
                || environment.len() > 64
                || cwd
                    .as_ref()
                    .is_some_and(|s| !Path::new(s).is_absolute() || s.contains('\0'))
            {
                return Err(McpError::Protocol);
            }
        }
        PrivateConfig::StreamableHttp { endpoint, auth } => {
            transport::BoundedHttpClient::new(
                vec![reqwest::Url::parse(endpoint).map_err(|_| McpError::Endpoint)?],
                MESSAGE_BYTES,
            )?;
            match auth {
                Auth::Manual { headers } => {
                    if headers.len() > 32 {
                        return Err(McpError::Limit);
                    }
                    for (k, v) in headers {
                        let name = http::HeaderName::from_bytes(k.as_bytes())
                            .map_err(|_| McpError::Protocol)?;
                        http::HeaderValue::from_str(v).map_err(|_| McpError::Protocol)?;
                        if matches!(
                            name.as_str(),
                            "host"
                                | "content-length"
                                | "mcp-session-id"
                                | "accept"
                                | "content-type"
                                | "last-event-id"
                        ) {
                            return Err(McpError::Protocol);
                        }
                    }
                }
                Auth::Oauth { client_id, scopes } => {
                    if client_id
                        .as_ref()
                        .is_some_and(|s| s.is_empty() || s.len() > 2048)
                        || scopes.len() > 32
                        || scopes
                            .iter()
                            .any(|s| s.len() > 256 || s.chars().any(char::is_control))
                    {
                        return Err(McpError::Limit);
                    }
                }
                _ => (),
            }
        }
    }
    Ok(())
}
fn check_public(e: &super::catalogue::Entry, c: &PrivateConfig) -> Result<()> {
    let (transport, auth, origin) = match c {
        PrivateConfig::Stdio { .. } => ("stdio", "none", None),
        PrivateConfig::StreamableHttp { endpoint, auth } => (
            "streamable_http",
            match auth {
                Auth::None => "none",
                Auth::Manual { .. } => "manual",
                Auth::Oauth { .. } => "oauth",
            },
            Some(
                reqwest::Url::parse(endpoint)
                    .map_err(|_| McpError::Endpoint)?
                    .origin()
                    .ascii_serialization(),
            ),
        ),
    };
    if e.transport != transport || e.auth != auth || e.endpoint_display != origin {
        return Err(McpError::VaultConflict);
    }
    Ok(())
}
async fn discover(
    server: &str,
    peer: &Peer<RoleClient>,
) -> Result<(HashSet<String>, HashMap<String, String>, Value)> {
    let mut tools = Vec::new();
    let mut resources = Vec::new();
    let mut seen = HashSet::new();
    let mut cursor = None;
    for page in 0..16 {
        let response = tokio::time::timeout(
            REQUEST_TIMEOUT,
            peer.list_tools(
                cursor
                    .clone()
                    .map(|cursor| PaginatedRequestParams::default().with_cursor(Some(cursor))),
            ),
        )
        .await
        .map_err(|_| McpError::Deadline)?
        .map_err(|_| McpError::Protocol)?;
        for t in response.tools {
            if tools.len() >= 128
                || t.name.is_empty()
                || t.name.len() > 256
                || serde_json::to_vec(&t)
                    .map_err(|_| McpError::Protocol)?
                    .len()
                    > 32768
            {
                return Err(McpError::Limit);
            }
            tools.push(t)
        }
        cursor = response.next_cursor;
        if let Some(c) = &cursor {
            if c.len() > 2048 || !seen.insert(c.clone()) || page == 15 {
                return Err(McpError::Limit);
            }
        } else {
            break;
        }
    }
    seen.clear();
    cursor = None;
    // Absence of resources capability is an empty catalogue, not a failed tool connection.
    if peer
        .peer_info()
        .is_some_and(|p| p.capabilities.resources.is_some())
    {
        for page in 0..16 {
            let response = tokio::time::timeout(
                REQUEST_TIMEOUT,
                peer.list_resources(
                    cursor
                        .clone()
                        .map(|cursor| PaginatedRequestParams::default().with_cursor(Some(cursor))),
                ),
            )
            .await
            .map_err(|_| McpError::Deadline)?
            .map_err(|_| McpError::Protocol)?;
            for r in response.resources {
                if resources.len() >= 128 || r.uri.len() > 2048 {
                    return Err(McpError::Limit);
                }
                resources.push(r)
            }
            cursor = response.next_cursor;
            if let Some(c) = &cursor {
                if c.len() > 2048 || !seen.insert(c.clone()) || page == 15 {
                    return Err(McpError::Limit);
                }
            } else {
                break;
            }
        }
    }
    let mut names = HashSet::new();
    for t in &tools {
        if !names.insert(t.name.to_string()) {
            return Err(McpError::Protocol);
        }
    }
    let mut handles = HashMap::new();
    for r in &resources {
        let handle = format!("resource_{}", fingerprint(&[server, r.uri.as_str()])?);
        if handles.insert(handle, r.uri.clone()).is_some() {
            return Err(McpError::Protocol);
        }
    }
    let discovery = json!({"tools":tools,"resources":resources});
    if serde_json::to_vec(&discovery)
        .map_err(|_| McpError::Protocol)?
        .len()
        > 524288
    {
        return Err(McpError::Limit);
    }
    Ok((names, handles, discovery))
}
