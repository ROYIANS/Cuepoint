import assert from "node:assert/strict";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";
const {chromium} = await import(process.env.C01_PLAYWRIGHT_PATH ?? "playwright");
const transport = {name: "d03-native-final-flush", enforce: "pre", transform(source, id) {
    if (!id.endsWith("/lib/agent/runChat.ts")) return source;
    return `import {db} from "@/db/database";
        export async function executeChatRun(run, _key, controller) {
            await window.d03.wait("flush");
            const status = controller.signal.aborted ? "interrupted" : "completed";
            await db.agentRuns.update(run.id, {status, finishedAt: new Date().toISOString()});
            window.d03.transport.push({model: run.model, aborted: controller.signal.aborted, status});
        }
        export async function resumeChatRun() {throw new Error("unexpected native resume transport");}`;
}};
const server = await createServer({configFile: false, plugins: [transport, react()], resolve: {alias: {"@": resolve("src")}}, server: {host: "127.0.0.1", port: 0}});
let browser;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, executablePath: process.env.C01_CHROMIUM_PATH});
    const page = await browser.newPage();
    const errors = []; let externalRequests = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();} return route.continue();});
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/d03/");
    await page.waitForFunction(() => window.d03 && document.querySelector("output"));
    const seed = await page.evaluate(() => window.d03.seedRetry());
    await page.evaluate(id => window.d03.changeThread(id), seed.threadId);
    await page.waitForFunction(id => window.d03.state().threadId === id, seed.threadId);
    await page.evaluate(id => {window.d03.hold("flush"); window.d03.startRetry(id);}, seed.runId);
    await page.waitForFunction(() => window.d03.state().sending && window.d03.state().locked);
    assert.equal(await page.evaluate(() => window.d03.acquire("duplicate")), false);
    await page.waitForFunction(async id => {const {db} = await import("/src/db/database.ts"); return await db.agentRuns.filter(run => run.retryOfRunId === id).count() > 0;}, seed.runId);
    await page.evaluate(() => window.d03.changeThread("other"));
    await page.waitForFunction(() => window.d03.state().aborted === true);
    assert.equal(await page.evaluate(() => window.d03.acquire("before-flush")), false);
    await page.evaluate(async () => {window.d03.release("flush"); await window.d03.settle();});
    await page.waitForFunction(() => !window.d03.state().sending && !window.d03.state().locked);
    assert.deepEqual(await page.evaluate(() => window.d03.transport), [{model: "original-model", aborted: true, status: "interrupted"}]);
    assert.equal(await page.evaluate(() => window.d03.acquire("old")), true);
    await page.evaluate(() => window.d03.releaseToken("old"));
    assert.equal(await page.evaluate(() => window.d03.acquire("new")), true);
    await page.evaluate(() => window.d03.releaseToken("old"));
    assert.equal(await page.evaluate(() => window.d03.state().locked), true);
    await page.evaluate(() => window.d03.releaseToken("new"));
    const approval = await page.evaluate(() => window.d03.approval());
    const packages = await page.evaluate(() => window.d03.packages());
    await page.evaluate(id => {window.d03.observeProject(id); window.dispatchEvent(new Event("focus"));}, packages.importedHistoryProject);
    await page.waitForFunction(id => document.querySelector("[data-observed-project]")?.getAttribute("data-observed-project") === id, packages.importedHistoryProject);
    // Exercise an actual production 7000 ms polling interval; imported jobs must remain dormant.
    await page.waitForTimeout(7200);
    const audio = await page.evaluate(() => window.d03.renderExport());
    assert.equal(externalRequests, 0); assert.deepEqual(errors, []);
    console.log(JSON.stringify({lifecycle: {frozenRetry: true, scopeAbort: true, finalFlushLock: true, lateReleaseOwnership: true}, approval, packages, importedJobMountFocusPollNoRequests: true, audio, externalRequests, pageErrors: errors.length, limitation: "Actual native IndexedDB/Web Locks/ZIP/Web Audio and React hook lifecycle; chat transport is a controlled local final flush, no provider or acoustic-quality claim"}));
} finally {await browser?.close(); await server.close();}
