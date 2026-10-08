import assert from "node:assert/strict";
import {readFile, writeFile, mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";

// Installed tooling only. Optional baseline files reproduce the original risk
// without replacing shared working-tree files or touching the B01 fixture.
const {chromium} = await import(process.env.B07_PLAYWRIGHT_PATH ?? "playwright");
const surfacePath = "/tests/fixtures/b07/surface.tsx";
const transport = {
    name: "b07-isolated-provider", enforce: "pre",
    async transform(source, id) {
        if (process.env.B07_BASELINE_ROOT && /\/components\/agent\/(AgentChatPage.tsx|useReferenceDraft.ts)$/.test(id)) {
            source = await readFile(join(process.env.B07_BASELINE_ROOT, id.split("/").at(-1)), "utf8");
        }
        const leaves = {
            "/components/agent/ChatWorkspace.tsx": "Surface as ChatWorkspace",
            "/components/agent/HomeWelcome.tsx": "Surface as HomeWelcome",
            "/components/agent/TaskBoard.tsx": "Leaf as TaskBoard",
            "/components/agent/TaskInspector.tsx": "Leaf as TaskInspector",
            "/components/agent/AgentComposerAttention.tsx": "Leaf as AgentComposerAttention",
            "/components/agent/ContextUsagePanel.tsx": "Leaf as ContextUsageTrigger",
        };
        for (const [suffix, names] of Object.entries(leaves)) if (id.endsWith(suffix)) return `export {${names}} from "${surfacePath}";`;
        if (id.endsWith("/components/agent/AgentChatPage.tsx")) {
            source = source.replace('from "@lobehub/ui"', `from "${surfacePath}"`);
        }
        if (id.endsWith("/db/chat.ts")) {
            source = source.replace("export async function createChatThread(", "async function _b07_createChatThread(");
            source += `\nexport async function createChatThread(...args: Parameters<typeof _b07_createChatThread>) {
                const fixture = typeof window === "undefined" ? undefined : window.b07;
                if (fixture) {fixture.calls.push({kind: "create", payload: args[0]}); await fixture.wait("create");}
                return _b07_createChatThread(...args);
            }`;
        }
        if (id.endsWith("/db/agentRuns.ts")) {
            source = source.replace("export async function beginAgentRun(", "async function _b07_beginAgentRun(");
            source += `\nexport async function beginAgentRun(...args: Parameters<typeof _b07_beginAgentRun>) {
                window.b07.calls.push({kind: "begin", payload: args[0]}); await window.b07.wait("begin");
                return _b07_beginAgentRun(...args);
            }`;
        }
        if (id.endsWith("/lib/agent/runChat.ts")) return `
            import {db} from "@/db/database";
            export async function executeChatRun(run, _key, controller) {
                const fixture = window.b07; await fixture.wait("execute");
                fixture.calls.push({kind: "execute", aborted: controller.signal.aborted});
                await db.agentRuns.update(run.id, {status: controller.signal.aborted ? "interrupted" : "completed", finishedAt: new Date().toISOString()});
            }
            export async function resumeChatRun() {throw new Error("fixture does not resume provider calls");}`;
        if (id.endsWith("/lib/ai/connectors.ts")) {
            source = source.replace("export async function discoverConnectorChatModels(", "async function _b07_discoverConnectorChatModels(");
            source += '\nexport async function discoverConnectorChatModels() {return {ok: true, models: ["model"], incompatibleModels: []};}';
        }
        return source;
    },
};
const server = await createServer({configFile: false, plugins: [transport, react()], resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 0}});
let browser; let passed = 0;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.B07_CHROMIUM_PATH ? {executablePath: process.env.B07_CHROMIUM_PATH} : {})});
    const page = await browser.newPage(); const errors = []; let externalRequests = 0;
    page.on("pageerror", error => {errors.push(error.message); console.error("browser error", error.message);});
    await page.route("**/*", route => {
        if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();}
        return route.continue();
    });
    page.setDefaultTimeout(10000);
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/b07/");
    await page.waitForFunction(() => Boolean(window.b07));
    const ids = await page.evaluate(() => ({a: window.b07.a, b: window.b07.b, reference: window.b07.referenceId}));
    const field = page.getByRole("textbox", {name: "draft"});
    const click = name => page.getByRole("button", {name, exact: true}).click();
    const navigate = async id => {await page.evaluate(id => window.b07.navigate(id), id); await page.locator(`main[data-owner="${id ?? "home"}"]`).waitFor();};
    const value = async expected => {await page.waitForFunction(expected => document.querySelector("textarea")?.value === expected, expected);};
    const idle = async () => {await page.waitForFunction(() => document.querySelector('[data-testid="sending"]')?.textContent === "false");};
    const test = async (name, operation) => {
        try {await operation(); assert.equal(errors.length, 0, errors.join("\n")); passed++; console.log(`PASS ${name}`);}
        catch (error) {
            const directory = await mkdtemp(join(tmpdir(), "b07-browser-failure-"));
            await page.screenshot({path: join(directory, "failure.png"), fullPage: true});
            await writeFile(join(directory, "failure.html"), await page.content());
            console.error(`FAIL ${name}; ${passed} passed; artifacts: ${directory}`); throw error;
        }
    };
    await test("actual browser history A/B/back/forward keeps thread text and references aligned", async () => {
        await navigate(ids.a); await field.fill("Browser A"); await click("Attach");
        await click("Thread B"); await page.locator(`main[data-owner="${ids.b}"]`).waitFor();
        assert.equal(await field.inputValue(), ""); await field.fill("Browser B");
        await page.evaluate(() => window.history.back()); await page.locator(`main[data-owner="${ids.a}"]`).waitFor();
        await value("Browser A"); assert.equal(await page.getByTestId("references").textContent(), ids.reference);
        await page.evaluate(() => window.history.forward()); await page.locator(`main[data-owner="${ids.b}"]`).waitFor();
        await value("Browser B"); assert.equal(await page.getByTestId("references").textContent(), "");
    });
    await test("real Web Lock/new-thread navigation preserves captured persisted payload and later home edits", async () => {
        await navigate(); await click("Project"); await click("Model"); await field.fill("Captured browser payload"); await click("Attach");
        await page.evaluate(() => {window.b07.hold("create"); window.b07.hold("begin");}); await click("Send");
        await page.waitForFunction(() => window.b07.calls.some(call => call.kind === "create")); await field.fill("Newer home text");
        await page.evaluate(() => window.b07.release("create"));
        await page.waitForFunction(() => window.b07.calls.some(call => call.kind === "begin"));
        await value("Captured browser payload"); assert.equal(await page.getByTestId("references").textContent(), ids.reference);
        const target = await page.locator("main").getAttribute("data-owner"); assert.notEqual(target, "home");
        await page.evaluate(() => window.b07.release("begin")); await idle(); await value("");
        const records = await page.evaluate(() => window.b07.records());
        const message = records.messages.find(message => message.threadId === target && message.role === "user");
        assert.equal(message.content, "Captured browser payload"); assert.deepEqual(message.attachments, [{referenceId: ids.reference, revision: 1}]);
        assert.equal(records.runs.filter(run => run.threadId === target).length, 1);
        assert.equal(records.runs.find(run => run.threadId === target).status, "completed");
        assert.equal((await page.evaluate(() => window.b07.calls.filter(call => call.kind === "execute").at(-1))).aborted, false);
        await navigate(); await value("Newer home text"); assert.equal(await page.getByTestId("references").textContent(), "");
    });
    await test("begin failure after navigation remains visible and retries without creating another topic", async () => {
        await field.fill("Failure payload"); await click("Attach"); await page.evaluate(() => window.b07.failures.add("begin"));
        const before = await page.evaluate(() => window.b07.calls.filter(call => call.kind === "create").length);
        await click("Send"); await idle(); await value("Failure payload"); assert.equal(await page.getByTestId("references").textContent(), ids.reference);
        const target = await page.locator("main").getAttribute("data-owner"); assert.notEqual(target, "home");
        assert.equal((await page.evaluate(() => window.b07.records())).runs.filter(run => run.threadId === target).length, 0);
        await page.evaluate(() => window.b07.failures.delete("begin")); await click("Send"); await idle(); await value("");
        assert.equal(await page.evaluate(() => window.b07.calls.filter(call => call.kind === "create").length), before + 1);
        assert.equal((await page.evaluate(() => window.b07.records())).runs.filter(run => run.threadId === target).length, 1);
    });
    await test("actual back event aborts old execution without clearing equal text in another owner", async () => {
        await navigate(ids.b); await field.fill("Browser A"); await navigate(ids.a);
        await page.evaluate(() => window.b07.hold("begin")); await click("Send");
        await page.waitForFunction(id => window.b07.calls.some(call => call.kind === "begin" && call.payload.threadId === id), ids.a);
        // The POP itself is the first thread change after this send begins.
        await page.evaluate(() => window.history.back()); await page.locator(`main[data-owner="${ids.b}"]`).waitFor();
        await page.evaluate(() => window.b07.release("begin")); await idle(); await value("Browser A");
        assert.equal((await page.evaluate(() => window.b07.calls.filter(call => call.kind === "execute").at(-1))).aborted, true);
        await navigate(ids.a); await value("");
    });
    await test("failed new-topic action keeps old unsent payload and no provider call", async () => {
        await field.fill("Unsent old topic"); await click("Attach"); await page.evaluate(() => window.b07.failures.add("create"));
        const executions = await page.evaluate(() => window.b07.calls.filter(call => call.kind === "execute").length);
        await click("New topic"); await page.getByText("fixture create failure", {exact: true}).waitFor();
        await value("Unsent old topic"); assert.equal(await page.getByTestId("references").textContent(), ids.reference);
        assert.equal(await page.evaluate(() => window.b07.calls.filter(call => call.kind === "execute").length), executions);
    });
    assert.equal(externalRequests, 0); console.log(`B07 browser: ${passed} scenarios passed; external/provider requests: ${externalRequests}`);
} finally {await browser?.close(); await server.close();}
