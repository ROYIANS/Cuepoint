import assert from "node:assert/strict";
import {mkdtemp, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
const {chromium} = await import(process.env.B01_PLAYWRIGHT_PATH ?? "playwright");
const seams = {name: "d04-controlled-read-timing", enforce: "pre", transform(source, id) {
    if (id.endsWith("/src/db/agentContextPreview.ts")) {
        source = source.replace("export async function readAgentContextPreview(", "async function _nativeReadAgentContextPreview(");
        source += `\nexport async function readAgentContextPreview(input: ContextPreviewInput): Promise<ContextPreviewRead> {
            const identity = contextPreviewIdentity(input);
            await window.d04?.waitPreview(input, identity);
            const result = await _nativeReadAgentContextPreview(input);
            window.d04?.previewFinished(identity);
            return result;
        }`;
    }
    if (id.endsWith("/src/components/agent/ContextParameters.tsx")) source = source.replace("    try {\n        return {scopeKey", "    try {\n        await window.d04?.waitPolicy();\n        return {scopeKey");
    const write = id.endsWith("/src/db/contextSettings.ts") ? "updateContextPolicy" : id.endsWith("/src/db/memoryRetrieval.ts") ? "setThreadMemoryExcluded" : undefined;
    if (write) {
        source = source.replace(`export async function ${write}(`, `async function _native_${write}(`);
        source += `\nexport async function ${write}(...args: Parameters<typeof _native_${write}>) {await window.d04?.waitWrite(); return _native_${write}(...args);}`;
    }
    return source;
}};
const server = await createServer({configFile: false, plugins: [seams, react()], resolve: {alias: {"@": resolve("src")}}, server: {host: "127.0.0.1", port: 0}});
let browser;
let passed = 0;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, executablePath: process.env.B01_CHROMIUM_PATH});
    const page = await browser.newPage(); const errors = []; let externalRequests = 0;
    page.on("pageerror", error => {errors.push(error.message); console.error(error.message);});
    await page.route("**/*", route => {if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();} return route.continue();});
    page.setDefaultTimeout(10000);
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/d04/");
    await page.waitForFunction(() => window.d04 && document.querySelector(".agent-context-trigger"));
    const ids = await page.evaluate(() => ({a: window.d04.a, b: window.d04.b, c: window.d04.c, project: window.d04.projectId, other: window.d04.otherProjectId, image: window.d04.image}));
    const open = async () => {if (!await page.getByRole("region", {name: "上下文明细"}).count()) await page.getByRole("button", {name: "上下文明细", exact: true}).click();};
    const ready = async () => {await page.waitForFunction(() => document.querySelector(".agent-context-breakdown"));};
    const choose = async (threadId, projectId, model = "unknown", draft = "native draft", attachments = []) => {
        await page.evaluate(args => window.d04.choose(...args), [threadId, projectId, model, draft, attachments]);
        await page.waitForFunction(owner => document.querySelector("main")?.getAttribute("data-owner") === owner, threadId ?? "home");
    };
    const test = async (name, operation) => {await operation(); assert.equal(errors.length, 0, errors.join("\n")); passed++; console.log(`PASS ${name}`);};
    await test("actual trigger and Radix panel keep one preview subscription across open/close", async () => {
        await open(); await ready();
        const before = await page.evaluate(() => window.d04.reads.length);
        await page.getByRole("button", {name: "关闭上下文明细"}).click(); await open(); await ready();
        assert.equal(await page.evaluate(() => window.d04.reads.length), before);
        assert.match(await page.locator(".agent-context-trigger").getAttribute("title"), /上下文预计占用/);
        assert.equal(await page.locator(".agent-context-memory-link").count(), 1);
    });
    await test("late A/B/error/model/draft/attachment completions show loading and never publish foreign facts", async () => {
        await page.evaluate(() => window.d04.hold("held"));
        await choose(ids.c, ids.other, "held", "changed draft");
        await page.getByText("正在读取上下文…", {exact: true}).waitFor();
        assert.equal(await page.locator(".agent-context-project").count(), 0);
        assert.equal(await page.locator(".agent-context-trigger circle[stroke-dasharray]").count(), 0);
        await choose(ids.a, ids.project, "gpt-4o", "current draft", [ids.image]); await ready();
        assert.match(await page.getByRole("region", {name: "上下文明细"}).innerText(), /Native project A/);
        const reads = await page.evaluate(() => window.d04.reads.length);
        await page.evaluate(() => window.d04.release("held"));
        await page.waitForFunction(count => window.d04.reads.length > count, reads);
        assert.match(await page.getByRole("region", {name: "上下文明细"}).innerText(), /Native project A/);
        await page.evaluate(() => {window.d04.fail(true);});
        await choose(ids.a, ids.project, "unknown", "failure draft");
        await page.getByRole("alert").filter({hasText: "native deliberate read failure"}).waitFor();
        assert.equal(await page.locator(".agent-context-breakdown").count(), 0);
        assert.equal(await page.locator(".agent-context-trigger circle[stroke-dasharray]").count(), 0);
        await page.evaluate(() => window.d04.fail(false)); await choose(ids.a, ids.project, "unknown", "recovered"); await ready();
    });
    await test("same-project memory sheet follows thread identity and pending exclusion stays with its origin", async () => {
        await page.locator(".agent-context-memory-link").click();
        await page.getByRole("button", {name: "本对话排除", exact: true}).waitFor();
        assert.equal(await page.getByRole("region", {name: "上下文明细"}).count(), 0);
        await page.evaluate(() => window.d04.hold("write"));
        await page.getByRole("button", {name: "本对话排除", exact: true}).click();
        await page.getByRole("button", {name: "保存中…", exact: true}).waitFor();
        await choose(ids.b, ids.project); await page.getByRole("button", {name: "本对话排除", exact: true}).waitFor();
        assert.equal(await page.getByRole("button", {name: "本对话排除", exact: true}).isEnabled(), true);
        await page.evaluate(() => window.d04.release("write"));
        await page.waitForFunction(async id => (await window.d04.exclusions(id)).length === 1, ids.a);
        assert.deepEqual(await page.evaluate(id => window.d04.exclusions(id), ids.b), []);
        assert.equal(await page.getByRole("button", {name: "本对话排除", exact: true}).isEnabled(), true);
        await page.keyboard.press("Escape");
    });
    await test("policy query pending/missing/error and delayed mutation honor the current thread session", async () => {
        await page.evaluate(id => {window.d04.hold("policy"); window.d04.parameters(id);}, ids.a);
        await page.getByText("正在读取参数…", {exact: true}).waitFor();
        assert.equal(await page.getByRole("switch", {name: "自动压缩上下文"}).isDisabled(), true);
        await page.evaluate(id => window.d04.parameters(id), ids.b);
        await page.evaluate(() => window.d04.release("policy"));
        await page.waitForFunction(() => !document.querySelector("#context-auto")?.hasAttribute("disabled"));
        await page.evaluate(() => window.d04.hold("write"));
        await page.getByRole("switch", {name: "自动压缩上下文"}).click();
        await page.getByText("正在保存…", {exact: true}).waitFor();
        await page.evaluate(id => window.d04.parameters(id), ids.a);
        await page.waitForFunction(() => !document.querySelector("#context-auto")?.hasAttribute("disabled"));
        await page.evaluate(() => window.d04.release("write"));
        await page.waitForFunction(async id => (await window.d04.policy(id))?.autoCompress === false, ids.b);
        assert.equal((await page.evaluate(id => window.d04.policy(id), ids.a)).autoCompress, true);
        await page.evaluate(() => window.d04.parameters("missing"));
        await page.getByText("参数所属对话或助手已不存在", {exact: true}).waitFor();
        assert.equal(await page.getByRole("switch", {name: "自动压缩上下文"}).isDisabled(), true);
        await page.evaluate(() => {window.d04.fail(true); window.d04.parameters();});
        await page.getByRole("alert").filter({hasText: "native deliberate read failure"}).waitFor();
        assert.equal(await page.getByRole("switch", {name: "自动压缩上下文"}).isDisabled(), true);
        await page.evaluate(() => {window.d04.fail(false); window.d04.hideParameters();});
    });
    await test("native readonly snapshot blocks a concurrent writer through every nested project/memory/reference read", async () => {
        const result = await page.evaluate(() => window.d04.coherent());
        assert.equal(result.before.status, "ready", JSON.stringify(result.before)); assert.equal(result.after.status, "ready", JSON.stringify(result.after));
        assert.equal(result.writerStarted, true); assert.equal(result.writerFinished, true);
        assert.equal(result.finishedAtRead, false); assert.equal(result.oneNativeTransaction, true);
        assert.match(result.before.facts.taskContext.projectContext.content, /OLD PROJECT/);
        assert.match(JSON.stringify(result.before.facts.memorySelection), /OLD MEMORY/);
        assert.match(result.after.facts.taskContext.projectContext.content, /NEW PROJECT/);
        assert.match(JSON.stringify(result.after.facts.memorySelection), /NEW MEMORY/);
        assert.equal(result.before.facts.selectedReferences.images.length, 1);
        for (const observation of result.observations) {assert.equal(observation.mode, "readonly"); assert.deepEqual(observation.outerStores.sort(), result.expectedStores.sort()); assert(observation.stores.every(store => result.expectedStores.includes(store)));}
        for (const table of ["projects", "projectMemories", "projectReferences", "media"]) assert(result.observations.some(row => row.table === table));
        console.log("native concurrent proof", JSON.stringify({...result, before: {status: result.before.status}, after: {status: result.after.status}}));
    });
    await test("missing thread and foreign requested project never produce a loaded budget", async () => {
        await choose("missing", ids.project); await open();
        await page.getByRole("alert").filter({hasText: "对话不存在"}).waitFor(); assert.equal(await page.locator(".agent-context-breakdown").count(), 0);
        await choose(ids.a, ids.other); await page.getByRole("alert").filter({hasText: "范围不匹配"}).waitFor(); assert.equal(await page.locator(".agent-context-breakdown").count(), 0);
    });
    assert.equal(externalRequests, 0); assert.equal(errors.length, 0);
    console.log(`${passed} native D04 scenarios PASS; 0 external provider requests`);
} catch (error) {
    const directory = await mkdtemp(join(tmpdir(), "d04-native-failure-"));
    if (browser) {
        const page = browser.contexts()[0]?.pages()[0];
        if (page) {await page.screenshot({path: join(directory, "failure.png"), fullPage: true}); await writeFile(join(directory, "failure.html"), await page.content());}
    }
    console.error(`native failure after ${passed} passed; artifacts ${directory}`); throw error;
} finally {await browser?.close(); await server.close();}
