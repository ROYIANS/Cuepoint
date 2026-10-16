import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {createRootRoute, createRoute, createRouter, createBrowserHistory, Outlet, RouterProvider} from '@tanstack/react-router';
import {Toaster} from 'sonner';
import {AppFrame} from '@/app/layout/AppFrame';
import {ContextPanel, ContextPanelContent, ContextPanelTitle} from '@/app/layout/context-panel';
import {LobeChatTheme} from '@/features/agent/ui/LobeChatTheme';
import {AgentChatPage} from '@/features/agent/ui/AgentChatPage';
import {SettingsPage} from '@/features/settings/ui/SettingsPage';
import {createChatThread, updateChatThread} from '@/features/agent/commands/chat';
import {createProject} from '@/features/projects/commands/projects';
import {createNativeMcpServices} from '@/platform/runtime/nativeMcp';
import {installMcpHostServices} from '@/platform/runtime/mcpServices';
import {mcpRuntimeOwner} from '@/features/agent/mcp/runtime/owner';
import {getMcpCatalogue} from '@/features/agent/mcp/queries/catalogue';
import type {McpPrivateConfig, McpPrivateRevisionRef} from '@/platform/runtime/mcp';
import {db} from '@/platform/product/store';
import '@/ui/theme.css';

// The actual manager, session/core, ProductStore and ContextPanelHost run unchanged.
// Only the fixed native IPC boundary and the model's streaming transport are controlled.
const at = '2026-10-16T00:00:00.000Z';
const connector = {id: 'mcp-browser-fixture', definitionId: 'openai-compatible' as const, protocol: 'openai-compatible' as const,
    label: 'Offline acceptance', baseUrl: 'https://mcp-management.fixture.test/v1', apiKey: 'offline-fixture-only', updatedAt: at};
await db.open(); await db.connectors.put(connector);
const project = await createProject('MCP retained acceptance');
const thread = await createChatThread({title: 'Retained MCP conversation', projectId: project.id, connectorId: connector.id, model: 'gpt-4o'});
await updateChatThread(thread.id, {interactionMode: 'conversation'});
for (let index = 0; index < 12; index++) await db.chatMessages.put({id: `mcp-history-${index}`, threadId: thread.id,
    role: index % 2 ? 'assistant' : 'user', status: 'complete', createdAt: `2026-10-14T00:${String(index).padStart(2, '0')}:00.000Z`,
    content: `History ${index}. ` + 'Retained conversation context. '.repeat(30)});

type ActionRecord = {type: string; operationId: string; serverId?: string};
const actions: ActionRecord[] = [], privateConfigs: McpPrivateConfig[] = [];
const originalRevisions = new Map<string, McpPrivateRevisionRef>();
const gates = new Map<string, {promise: Promise<void>; release: () => void}>();
const nextModes = new Map<string, 'known_failure' | 'unknown'>();
let registration = 0;
const host = createNativeMcpServices(async () => ({version: 1, session: 'session_management', workspaceId: 'workspace_management', generation: 1}), async (command, input) => {
    if (command !== 'mcp_service_request') throw new Error('Unexpected native command');
    const request = input.request as {operationId: string; action: {type: string; serverId?: string; configRevision?: number; config?: McpPrivateConfig; attemptId?: string}};
    const action = request.action;
    actions.push({type: action.type, operationId: request.operationId, ...(action.serverId ? {serverId: action.serverId} : {})});
    const mode = nextModes.get(action.type); nextModes.delete(action.type);
    await gates.get(action.type)?.promise;
    const reply = (status: string, result?: unknown, code?: string) => ({version: 1, operationId: request.operationId, hostSessionId: 'host_management', status,
        ...(result === undefined ? {} : {result}), ...(code ? {error: {code, message: 'Controlled finite fixture result'}} : {})});
    if (mode === 'known_failure') return reply('notStarted', undefined, 'vault_unavailable');
    switch (action.type) {
        case 'capabilities': return reply('completed', {host: 'desktop', stdio: true, streamableHttp: true, oauth: true, rememberedCredentials: true});
        case 'retire': case 'disconnect': case 'dispose': return reply('drained');
        case 'privatePrepare': {
            privateConfigs.push(action.config!);
            let reference = originalRevisions.get(request.operationId);
            if (!reference) {reference = {kind: 'native_vault', ownerId: 'vault_management', revisionId: `private_${originalRevisions.size + 1}`}; originalRevisions.set(request.operationId, reference);}
            if (mode === 'unknown') throw new Error('Original private write ACK was lost');
            return reply('prepared', {reference});
        }
        case 'privateStatus': {
            const reference = originalRevisions.get(request.operationId);
            return reference ? reply('prepared', {reference}) : reply('unknown');
        }
        case 'privateConfirm': return reply('completed', {confirmed: true});
        case 'privateDiscard': return reply('completed');
        case 'connect': return reply('connected', {binding: {serverId: action.serverId, configRevision: action.configRevision, manifestRevision: `raw_${++registration}`,
            registrationId: `registration_${registration}`, hostSessionId: 'host_management', principalRevision: 'principal_management'},
            discovery: {tools: [{name: 'inspect', description: 'Inspect fixture data', inputSchema: {type: 'object', properties: {}, additionalProperties: false}}], resources: [{uri: 'fixture://catalogue/item', name: 'Fixture item'}]}});
        case 'oauthBegin': return reply('prepared', {attemptId: `login_${registration + 1}`, redirectDisplay: '127.0.0.1'});
        case 'oauthStatus': return reply('prepared', {attemptId: action.attemptId, state: 'authorized'});
        case 'oauthCancel': return reply('canceled');
        default: throw new Error(`Unexpected fixed action ${action.type}`);
    }
});
installMcpHostServices(host); await host.initialize();
const owner = mcpRuntimeOwner()!.connections;
await owner.save({operationId: 'seed_save', serverId: 'server_seed', catalogueRevision: 0, expectedConfigRevision: 0,
    label: 'Existing fixture service', enabled: true, privateConfig: {transport: 'streamable_http', endpoint: 'https://existing.fixture.test/mcp', auth: {kind: 'none'}}});
actions.splice(0); privateConfigs.splice(0);

let showReference = (open: boolean) => {void open;};
function ReferencePanel() {
    const [open, setOpen] = useState(false); showReference = setOpen;
    return <><button type="button" data-fixture-reference onClick={() => setOpen(true)}>打开参考面板</button>
        <ContextPanel open={open} onOpenChange={setOpen} width={400}><ContextPanelContent returnLabel="返回对话"><ContextPanelTitle>参考面板</ContextPanelTitle><p>Another retained workspace panel.</p></ContextPanelContent></ContextPanel></>;
}
function ChatWorkspace() {
    return <LobeChatTheme><div style={{height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column'}}>
        <div data-fixture-actions style={{padding: '4px 12px'}}><ReferencePanel/></div>
        <div style={{flex: '1 1 auto', minHeight: 0}}><AgentChatPage threadId={thread.id}/></div>
    </div></LobeChatTheme>;
}
function SettingsWorkspace() {
    const [section, setSection] = useState('connections');
    return <SettingsPage section={section} onSectionChange={setSection}/>;
}
function Frame() {return <AppFrame contentScroll="hidden"><Outlet/><Toaster/></AppFrame>;}
const root = createRootRoute({component: Frame});
const agentRoute = createRoute({getParentRoute: () => root, path: 'agent/$threadId', component: ChatWorkspace});
const settingsRoute = createRoute({getParentRoute: () => root, path: 'settings', component: SettingsWorkspace});
window.history.replaceState(null, '', `/agent/${thread.id}`);
const router = createRouter({routeTree: root.addChildren([agentRoute, settingsRoute]), history: createBrowserHistory()});
const encoder = new TextEncoder();
const requests: Array<{url: string; method: string; aborted: boolean; body: string}> = [];
let stream: ReadableStreamDefaultController<Uint8Array> | undefined, sequence = 0;
const emit = (text: string) => {stream?.enqueue(encoder.encode(`data: ${JSON.stringify({id: 'mcp-live', choices: [{index: 0, delta: {content: text}, finish_reason: null}]})}\n\n`)); return ++sequence;};
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith(connector.baseUrl)) return originalFetch(input, init);
    if (url.endsWith('/models')) return Response.json({data: [{id: 'gpt-4o', object: 'model'}]});
    if (!url.endsWith('/chat/completions') || init?.method !== 'POST') throw new Error('Unexpected model fixture request');
    const request = {url, method: init.method, aborted: false, body: String(init.body)}; requests.push(request);
    init.signal?.addEventListener('abort', () => {request.aborted = true; stream?.error(new DOMException('Aborted', 'AbortError')); stream = undefined;}, {once: true});
    return new Response(new ReadableStream<Uint8Array>({start(controller) {stream = controller; emit('Live conversation remains active. ');}, cancel() {stream = undefined;}}), {headers: {'content-type': 'text/event-stream'}});
};
Object.assign(window, {mcpAcceptance: {db, thread, project, actions, privateConfigs, requests,
    hold: (type: string) => {let release!: () => void; const promise = new Promise<void>(done => {release = done;}); gates.set(type, {promise, release});},
    release: (type: string) => {gates.get(type)?.release(); gates.delete(type);},
    mode: (type: string, mode: 'known_failure' | 'unknown') => nextModes.set(type, mode),
    reference: () => showReference(true), emit,
    catalogue: () => getMcpCatalogue(),
    finish: () => {stream?.enqueue(encoder.encode('data: {"id":"mcp-live","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')); stream?.close(); stream = undefined;},
    current: async () => ({route: router.history.location.pathname, runs: await db.agentRuns.where('threadId').equals(thread.id).toArray(), requests, sequence}),
    privateLeaks: async () => JSON.stringify({deviceSettings: await db.deviceSettings.toArray(), runs: await db.agentRuns.toArray(), messages: await db.chatMessages.toArray()}),
    navigate: (to: string) => router.navigate({to})}});
createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>);
