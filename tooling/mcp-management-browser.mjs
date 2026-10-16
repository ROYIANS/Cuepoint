import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {prepareNativeFixture} from './native-fixture-ready.mjs';
import {assertAgentPackageFreshness} from './agent-package-inputs.ts';

await assertAgentPackageFreshness();

const {chromium} = await import(process.env.MCP_PLAYWRIGHT_PATH ?? 'playwright');
const cacheDir = await mkdtemp(join(tmpdir(), 'mcp-management-vite-'));
const output = process.env.MCP_EVIDENCE_DIR ?? await mkdtemp(join(tmpdir(), 'mcp-management-evidence-'));
await mkdir(output, {recursive: true});
await Promise.all(['wide.png', 'wide-editor.png', 'narrow.png', 'failure.png', 'failure.html', 'result.json'].map(name => rm(join(output, name), {force: true})));
const fixture = '/tests/fixtures/mcp-management/';
const server = await createServer({configFile: false, cacheDir, publicDir: fileURLToPath(new URL('../packages/distribution/public', import.meta.url)),
    plugins: [react(), tailwindcss()], optimizeDeps: {holdUntilCrawlEnd: false, entries: [fileURLToPath(new URL(`..${fixture}index.html`, import.meta.url))]},
    resolve: {alias: [{find: '@', replacement: fileURLToPath(new URL('../packages/studio/src', import.meta.url))}]},
    server: {host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: {ignored: ['**/.trellis/**']}}});
const observations = [], errors = [], documents = [], external = [];
let browser, page, url;
let narrowFocusReturned = false;
const sourceInputs = ['tooling/mcp-management-browser.mjs', 'tests/fixtures/mcp-management/harness.tsx',
    'packages/studio/src/features/agent/ui/AgentControls.tsx', 'packages/studio/src/features/agent/ui/AgentChatPage.tsx',
    'packages/studio/src/features/agent/ui/McpConnectionsPanel.tsx',
    'packages/studio/src/app/layout/context-panel.tsx', 'packages/studio/src/app/layout/ContextPanelHost.tsx',
    'packages/studio/src/features/settings/ui/SettingsPage.tsx', 'packages/studio/src/features/settings/ui/ConnectorsPage.tsx',
    ...['McpManagementBody.tsx', 'McpConnectionEditor.tsx', 'McpConnectionDetail.tsx', 'McpConnectionsSettings.tsx', 'management.ts', 'editor.ts', 'mcpConnections.css'].map(name => `packages/studio/src/features/agent/mcp/ui/${name}`)];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = await Promise.all(sourceInputs.map(async path => ({path, sha256: sha256(await readFile(path))})));
const record = status => writeFile(join(output, 'result.json'), JSON.stringify({status, observations, errors, documents, external, sources, browser: browser?.version(), node: process.version,
    limits: 'Actual shared React manager, AppFrame/ContextPanelHost, AgentChatPage/core and IndexedDB; deterministic model stream and finite native command replies. Source browser acceptance, not installed native/Keychain/Windows/system browser proof.'}, null, 2) + '\n');
try {
    await server.listen(); await prepareNativeFixture(server, `${fixture}harness.tsx`);
    browser = await chromium.launch({headless: true, ...(process.env.MCP_CHROMIUM_PATH ? {executablePath: process.env.MCP_CHROMIUM_PATH} : {})});
    page = await browser.newPage({viewport: {width: 1440, height: 920}}); page.setDefaultTimeout(12_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {if (request.resourceType() === 'document' && request.frame() === page.mainFrame()) documents.push(request.url());});
    const origin = server.resolvedUrls.local[0];
    await page.route('**/*', async route => {
        const requestUrl = route.request().url();
        if (requestUrl.startsWith(origin) || requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
        external.push(requestUrl); return route.abort('blockedbyclient');
    });
    url = origin + fixture.slice(1); await page.goto(url); await page.waitForFunction(() => Boolean(window.mcpAcceptance));
    const ids = await page.evaluate(() => ({thread: window.mcpAcceptance.thread.id}));
    const expectedRoute = `/agent/${ids.thread}`;
    const composer = () => page.getByRole('textbox', {name: '消息内容', exact: true});
    const panel = () => page.locator('[data-slot="context-panel-content"][data-mcp-management]');
    const prompt = () => page.getByRole('alertdialog');
    const waitEnabled = async locator => page.waitForFunction(element => element && !element.disabled, await locator.elementHandle());
    const actions = type => page.evaluate(type => window.mcpAcceptance.actions.filter(action => action.type === type), type);
    const test = async (name, action) => {
        try {
            await action(); assert.deepEqual(errors, [], 'Browser errors fail acceptance');
            assert.deepEqual(documents, [url], 'Only the original document is allowed');
            assert(external.every(url => url.startsWith('https://registry.npmmirror.com/@lobehub/webfont-') || url.startsWith('https://registry.npmmirror.com/katex/')), 'Only known UI font/math assets may be requested externally (and are blocked)');
            observations.push({name, outcome: 'pass'}); console.log(`PASS ${name}`);
        } catch (error) {
            observations.push({name, outcome: 'fail', error: String(error)});
            observations.push({name: 'failure focus', active: await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 1000))});
            await page.screenshot({path: join(output, 'failure.png'), fullPage: true});
            await writeFile(join(output, 'failure.html'), await page.content()); await record('FAIL'); throw error;
        }
    };
    const assertRunning = async label => {
        const before = await page.evaluate(() => window.mcpAcceptance.current());
        assert.equal(before.route, expectedRoute); assert.equal(before.requests.length, 1); assert.equal(before.requests[0].aborted, false);
        const active = before.runs.find(run => run.status === 'running'); assert(active, 'Original run remains running');
        const marker = `[MCP acceptance ${label} ${before.sequence}] `;
        await page.evaluate(value => window.mcpAcceptance.emit(value), marker);
        await page.waitForFunction(({id, marker}) => window.mcpAcceptance.db.chatMessages.get(id).then(message => message?.content.includes(marker)), {id: active.assistantMessageId, marker});
        assert.equal((await page.evaluate(() => window.mcpAcceptance.current())).runs.find(run => run.status === 'running')?.id, active.id);
    };
    const open = async () => {
        await page.getByRole('button', {name: '更多选项', exact: true}).click();
        const entry = page.getByRole('menuitem').filter({hasText: 'MCP'});
        await entry.click();
        await panel().waitFor();
        await entry.waitFor({state: 'hidden'});
    };
    const requestClose = async () => {
        const back = panel().getByRole('button', {name: '返回对话', exact: true});
        if (await back.isVisible()) await back.click(); else await panel().getByRole('button', {name: '关闭', exact: true}).click();
    };
    const close = async () => {
        await requestClose();
        await panel().waitFor({state: 'hidden'});
    };
    const allConnections = () => panel().getByRole('button', {name: '全部连接', exact: true}).click();
    const add = async name => {
        await panel().getByRole('button', {name: '添加连接', exact: true}).click();
        await panel().getByLabel('连接名称', {exact: true}).fill(name);
    };
    const secrets = ['ui-executable-private-marker', 'ui-argument-private-marker', 'ui-directory-private-marker', 'ui-env-private-marker', 'ui-header-private-marker', 'ui-query-private-marker'];
    const localFields = async () => {
        await panel().getByLabel('可执行文件绝对路径', {exact: true}).fill('/ui-executable-private-marker');
        await panel().getByLabel('参数（JSON 数组）', {exact: true}).fill('["ui-argument-private-marker"]');
        await panel().getByLabel('工作目录（可选）', {exact: true}).fill('/ui-directory-private-marker');
        await panel().getByLabel('环境变量（JSON 对象）', {exact: true}).fill('{"TOKEN":"ui-env-private-marker"}');
    };
    await test('starts one real chat stream and retains a fresh unsent composer draft', async () => {
        await composer().fill('Start one continuous MCP acceptance reply');
        await page.getByRole('button', {name: '发送', exact: true}).click();
        await page.waitForFunction(() => window.mcpAcceptance.requests.length === 1);
        await composer().fill('Unsent MCP draft remains exact.\n第二行');
        await composer().evaluate(element => {window.mcpComposerNode = element; element.setSelectionRange(3, 8);});
        await assertRunning('initial');
    });
    await test('opens the real Agent MCP manager beside the retained running chat', async () => {
        await open(); await panel().getByText('Existing fixture service', {exact: true}).waitFor();
        await assertRunning('wide'); assert.equal(await composer().inputValue(), 'Unsent MCP draft remains exact.\n第二行');
        assert.equal(await composer().evaluate(element => element === window.mcpComposerNode), true);
        assert.equal(await prompt().count(), 0);
        await page.screenshot({path: join(output, 'wide.png'), fullPage: true});
    });
    await test('dirty close and panel replacement preserve the exact editor until explicit discard', async () => {
        await add('Retained editor draft'); await localFields();
        const input = panel().getByLabel('连接名称', {exact: true});
        await input.evaluate(element => {window.mcpEditorNode = element; element.focus(); element.setSelectionRange(2, 6);});
        await requestClose(); await prompt().getByText('保留未保存的修改？', {exact: true}).waitFor();
        await prompt().getByRole('button', {name: '继续编辑', exact: true}).click();
        assert.equal(await input.inputValue(), 'Retained editor draft');
        assert.equal(await input.evaluate(element => element === window.mcpEditorNode), true);
        await page.getByRole('button', {name: '打开参考面板', exact: true}).click();
        await prompt().getByText('保留未保存的修改？', {exact: true}).waitFor();
        await prompt().getByRole('button', {name: '继续编辑', exact: true}).click();
        await prompt().waitFor({state: 'hidden'});
        assert.equal(await input.evaluate(element => element === window.mcpEditorNode), true);
        assert.equal(await panel().isVisible(), true); await assertRunning('dirty');
        await page.screenshot({path: join(output, 'wide-editor.png'), fullPage: true});
    });
    await test('narrow full-width management retains the same editor/chat DOM and draft', async () => {
        const input = panel().getByLabel('连接名称', {exact: true});
        await page.setViewportSize({width: 720, height: 850});
        await panel().getByRole('button', {name: '返回对话', exact: true}).waitFor();
        assert.equal(await input.evaluate(element => element === window.mcpEditorNode), true);
        await assertRunning('narrow');
        await page.screenshot({path: join(output, 'narrow.png'), fullPage: true});
        await requestClose();
        await prompt().getByRole('button', {name: '放弃并离开', exact: true}).click();
        await panel().waitFor({state: 'hidden'});
        assert.equal(await composer().evaluate(element => element === window.mcpComposerNode), true);
        assert.equal(await composer().inputValue(), 'Unsent MCP draft remains exact.\n第二行');
        try {
            await page.waitForFunction(() => document.activeElement === window.mcpComposerNode || document.activeElement?.getAttribute('aria-label') === '更多选项', undefined, {timeout: 2000});
            narrowFocusReturned = true;
        } catch { /* Keep collecting independent UI evidence; final focus assertion still fails. */ }
        await page.setViewportSize({width: 1440, height: 920}); await assertRunning('returned');
    });
    await test('held save locks synchronously and blocks duplicate submission and departure', async () => {
        await open(); await add('Pending local service'); await localFields();
        await page.evaluate(() => window.mcpAcceptance.hold('privatePrepare'));
        const before = (await actions('privatePrepare')).length;
        await panel().getByRole('button', {name: '保存连接', exact: true}).click();
        await page.waitForFunction(count => window.mcpAcceptance.actions.filter(item => item.type === 'privatePrepare').length === count, before + 1);
        await panel().locator('form').evaluate(form => {form.requestSubmit(); form.requestSubmit();});
        assert.equal((await actions('privatePrepare')).length, before + 1);
        assert.equal(await panel().getByLabel('连接名称', {exact: true}).isDisabled(), true);
        await requestClose(); await prompt().getByText('正在处理修改', {exact: true}).waitFor();
        assert.equal(await prompt().getByRole('button', {name: '放弃并离开', exact: true}).count(), 0);
        await prompt().getByRole('button', {name: '继续编辑', exact: true}).click();
        await assertRunning('held-save'); await page.evaluate(() => window.mcpAcceptance.release('privatePrepare'));
        await panel().getByRole('heading', {name: 'Pending local service', exact: true}).waitFor();
        assert.equal((await actions('privatePrepare')).length, before + 1);
        assert.equal((await actions('connect')).length, 0);
        assert.equal(await panel().getByRole('button', {name: '连接', exact: true}).isDisabled(), true);
    });
    await test('known failure preserves private input and unknown save reads its original receipt without replay', async () => {
        await allConnections(); await add('Remote receipt service');
        await panel().getByLabel('传输方式', {exact: true}).selectOption('streamable_http');
        await panel().getByLabel('服务地址', {exact: true}).fill('https://ui-remote.fixture.test/mcp?token=ui-query-private-marker');
        await panel().getByLabel('认证方式', {exact: true}).selectOption('manual');
        await panel().getByLabel('请求头（JSON 对象）', {exact: true}).fill('{"Authorization":"Bearer ui-header-private-marker"}');
        await page.evaluate(() => window.mcpAcceptance.mode('privatePrepare', 'known_failure'));
        await panel().getByRole('button', {name: '保存连接', exact: true}).click();
        await panel().getByRole('alert').waitFor();
        assert.equal(await panel().getByLabel('服务地址', {exact: true}).inputValue(), 'https://ui-remote.fixture.test/mcp?token=ui-query-private-marker');
        await waitEnabled(panel().getByRole('button', {name: '保存连接', exact: true}));
        await page.evaluate(() => window.mcpAcceptance.mode('privatePrepare', 'unknown'));
        await panel().getByRole('button', {name: '保存连接', exact: true}).click();
        await panel().getByRole('button', {name: '核对保存结果', exact: true}).waitFor();
        assert.equal(await panel().getByRole('button', {name: '保存连接', exact: true}).isDisabled(), true);
        const prepares = await actions('privatePrepare'), original = prepares.at(-1).operationId;
        await panel().getByRole('button', {name: '核对保存结果', exact: true}).click();
        await panel().getByRole('heading', {name: 'Remote receipt service', exact: true}).waitFor();
        assert.equal((await actions('privatePrepare')).length, prepares.length);
        assert.equal((await actions('privateStatus')).at(-1).operationId, original);
        assert.equal((await actions('privateConfirm')).at(-1).operationId, original);
        assert.equal((await actions('connect')).length, 0); await assertRunning('original-receipt');
    });
    await test('explicit connection inspects only the frozen catalogue and replacement never rereads credentials', async () => {
        await allConnections(); await panel().getByRole('button', {name: /Pending local service/}).click();
        await panel().getByRole('switch', {name: '启用 Pending local service', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('[aria-label="启用 Pending local service"]')?.checked === true);
        await panel().getByRole('button', {name: '连接', exact: true}).click();
        await panel().getByRole('heading', {name: '已发现的能力', exact: true}).waitFor();
        await panel().getByText('Fixture item', {exact: true}).waitFor();
        assert.equal((await actions('connect')).length, 1);
        assert.equal((await actions('prepare')).length, 0); assert.equal((await actions('invoke')).length, 0);
        await panel().getByRole('button', {name: '断开连接', exact: true}).click();
        await panel().getByRole('button', {name: '连接', exact: true}).waitFor();
        await panel().getByRole('button', {name: '替换配置', exact: true}).click();
        assert.equal(await panel().getByLabel('可执行文件绝对路径', {exact: true}).inputValue(), '');
        assert.equal(await panel().getByLabel('环境变量（JSON 对象）', {exact: true}).inputValue(), '{}');
        await panel().getByLabel('可执行文件绝对路径', {exact: true}).fill('/replacement-private-marker');
        await page.getByRole('button', {name: '打开参考面板', exact: true}).click();
        await prompt().getByRole('button', {name: '放弃并离开', exact: true}).click();
        const reference = page.locator('[data-slot="context-panel-content"]').filter({hasText: '参考面板'});
        await reference.waitFor(); await reference.getByRole('button', {name: '关闭', exact: true}).click();
        await assertRunning('replacement-discard');
    });
    await test('actual private form values never enter public IndexedDB, web storage or model bytes', async () => {
        const privateConfigs = await page.evaluate(() => window.mcpAcceptance.privateConfigs);
        const privateBytes = JSON.stringify(privateConfigs);
        for (const marker of secrets) assert(privateBytes.includes(marker), `Private boundary saw ${marker}`);
        const publicBytes = await page.evaluate(async () => JSON.stringify({product: await window.mcpAcceptance.privateLeaks(), local: {...localStorage}, session: {...sessionStorage}, requests: window.mcpAcceptance.requests}));
        for (const marker of [...secrets, 'replacement-private-marker']) assert(!publicBytes.includes(marker), `No public projection contains ${marker}`);
    });
    await test('only deliberate final stream completion ends the original execution', async () => {
        await page.evaluate(() => window.mcpAcceptance.finish());
        await page.waitForFunction(() => window.mcpAcceptance.db.agentRuns.where('threadId').equals(window.mcpAcceptance.thread.id).toArray().then(runs => runs.some(run => run.status === 'completed')));
        assert.equal(await page.evaluate(() => window.mcpAcceptance.requests.length), 1);
        assert.equal((await page.evaluate(() => window.mcpAcceptance.current())).requests[0].aborted, false);
        assert.equal((await actions('connect')).length, 1, 'Only the deliberate connection was started');
    });
    await test('actual Settings search and navigation lock while the shared credential editor is open', async () => {
        await page.evaluate(() => window.mcpAcceptance.navigate('/settings'));
        const search = page.getByRole('searchbox', {name: '搜索设置', exact: true});
        await search.fill('MCP'); await page.getByRole('button', {name: '管理 MCP 连接', exact: true}).waitFor();
        await search.fill(''); await page.getByRole('button', {name: '管理 MCP 连接', exact: true}).click();
        await panel().waitFor();
        // The shared management owner may retain its selected row, but no discarded draft.
        if (await panel().getByRole('button', {name: '全部连接', exact: true}).isVisible()) await allConnections();
        await add('Settings credential draft');
        await panel().getByLabel('环境变量（JSON 对象）', {exact: true}).fill('{"TOKEN":"settings-private-marker"}');
        assert.equal(await search.isDisabled(), true);
        const navigation = page.locator('.settings-navigation-items button');
        assert(await navigation.count() >= 3);
        for (const button of await navigation.all()) assert.equal(await button.isDisabled(), true);
        const before = await search.inputValue();
        await search.evaluate(element => {element.value = 'settings-private-marker'; element.dispatchEvent(new Event('input', {bubbles: true})); element.dispatchEvent(new Event('change', {bubbles: true}));});
        await panel().getByRole('button', {name: '全部连接', exact: true}).click();
        await prompt().getByRole('button', {name: '继续编辑', exact: true}).click();
        assert.equal(await panel().getByLabel('连接名称', {exact: true}).inputValue(), 'Settings credential draft');
        await panel().getByRole('button', {name: '全部连接', exact: true}).click();
        await prompt().getByRole('button', {name: '放弃并离开', exact: true}).click();
        // Force an actual controlled-input render after an autofill-like event.
        await panel().getByRole('button', {name: '添加连接', exact: true}).click();
        assert.equal(await search.inputValue(), before, 'Credential autofill cannot change the settings filter state');
        await panel().getByRole('button', {name: '取消编辑', exact: true}).click();
        await panel().getByRole('button', {name: '关闭', exact: true}).click();
        await waitEnabled(search);
        const retained = await page.evaluate(() => window.mcpAcceptance.current());
        assert.equal(retained.requests.length, 1); assert.equal(retained.requests[0].aborted, false);
        const publicBytes = await page.evaluate(async () => JSON.stringify({product: await window.mcpAcceptance.privateLeaks(), local: {...localStorage}, session: {...sessionStorage}}));
        assert(!publicBytes.includes('settings-private-marker'));
    });
    await test('narrow discard returns focus to the retained chat control', async () => {assert.equal(narrowFocusReturned, true);});
    await test('acceptance source identities remained stable', async () => {for (const source of sources) assert.equal(sha256(await readFile(source.path)), source.sha256, source.path);});
    await record('PASS'); console.log(JSON.stringify({status: 'PASS', scenarios: observations.length, output}));
} catch (error) {await record('FAIL'); console.error(`Acceptance evidence: ${output}`); throw error;}
finally {await browser?.close(); await server.close(); await rm(cacheDir, {recursive: true, force: true});}
