import assert from "node:assert/strict";
import {mkdtemp, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {prepareNativeFixture} from "./native-fixture-ready.mjs";
const {chromium} = await import(process.env.E11_PLAYWRIGHT_PATH ?? "playwright");
const cacheDir = await mkdtemp(join(tmpdir(), "e11-vite-"));
const output = process.env.E11_EVIDENCE_DIR ?? await mkdtemp(join(tmpdir(), "e11-browser-"));
const fixture = "/tests/fixtures/e11-background/";
const server = await createServer({configFile: false, cacheDir, publicDir: fileURLToPath(new URL("../packages/distribution/public", import.meta.url)),
    plugins: [{name: "e11-held-creation", enforce: "pre", transform(code, id) {
        if (!id.endsWith("/features/agent/commands/chat.ts")) return;
        return code.replace("    const db = store ?? productDb;", "    await (globalThis as {__e11BeforeCreate?: () => Promise<void>}).__e11BeforeCreate?.();\n    const db = store ?? productDb;");
    }}, react(), tailwindcss()], optimizeDeps: {holdUntilCrawlEnd: false, entries: [fileURLToPath(new URL(`..${fixture}index.html`, import.meta.url))]},
    resolve: {alias: {"@": fileURLToPath(new URL("../packages/studio/src", import.meta.url))}},
    server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**"]}}});
const errors = [], checks = [];
let browser, page;
try {
    await server.listen(); await prepareNativeFixture(server, `${fixture}harness.tsx`);
    browser = await chromium.launch({headless: true, ...(process.env.E11_CHROMIUM_PATH ? {executablePath: process.env.E11_CHROMIUM_PATH} : {})});
    page = await browser.newPage({viewport: {width: 1440, height: 900}}); page.setDefaultTimeout(10000);
    page.on("pageerror", error => errors.push(error.message));
    const origin = server.resolvedUrls.local[0];
    await page.route("**/*", route => route.request().url().startsWith(origin) || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
    await page.goto(origin + fixture.slice(1)); await page.waitForFunction(() => Boolean(window.e11));
    const ids = await page.evaluate(() => ({a: window.e11.a.id, b: window.e11.b.id, c: window.e11.c.id, p: window.e11.project.id}));
    const composer = () => page.getByRole("textbox", {name: "消息内容", exact: true});
    const go = to => page.evaluate(to => window.e11.navigate(to), to);
    const test = async (name, run) => {await run(); assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.e11.errors), []); checks.push(name); console.log(`PASS ${name}`);};
    await test("optimistic message paints before preparation; A original request stays live", async () => {
        await composer().fill("E11 payload A");
        await page.getByRole("button", {name: "发送", exact: true}).click();
        await page.getByText("E11 payload A", {exact: true}).waitFor();
        await page.waitForFunction(() => window.e11.requests.length === 1);
        assert.equal(await page.evaluate(() => window.e11.requests[0].optimisticVisible), true);
        await composer().fill("Unsent A draft");
    });
    await test("A and B independent requests survive real settings/project and history navigation", async () => {
        await go(`/agent/${ids.b}`); await composer().fill("E11 payload B"); await page.getByRole("button", {name: "发送", exact: true}).click();
        await page.waitForFunction(() => window.e11.requests.length === 2); await composer().fill("Unsent B draft");
        await go("/settings"); await page.getByRole("heading", {name: "通用", exact: true}).waitFor();
        await go(`/p/${ids.p}`); await page.goBack(); await page.goBack(); await composer().waitFor();
        assert.equal(await composer().inputValue(), "Unsent B draft");
        await page.goForward(); await page.goForward();
        await page.evaluate(() => {window.e11.emit(0, "A while detached"); window.e11.emit(1, "B while detached");});
        await page.waitForFunction(() => window.e11.db.chatMessages.toArray().then(rows => rows.some(row => row.content.includes("A while detached")) && rows.some(row => row.content.includes("B while detached"))));
        const requests = await page.evaluate(() => window.e11.requests.map(request => ({aborted: request.aborted})));
        assert.deepEqual(requests, [{aborted: false}, {aborted: false}]);
        await go(`/agent/${ids.a}`); assert.equal(await composer().inputValue(), "Unsent A draft");
        assert.equal(await page.getByRole("alertdialog").count(), 0);
    });
    await test("Stop A leaves B live and reattachment does not dispatch", async () => {
        await page.getByRole("button", {name: "停止", exact: true}).last().click();
        await page.waitForFunction(() => window.e11.requests[0].aborted);
        await go(`/agent/${ids.b}`); await composer().waitFor();
        assert.equal(await composer().inputValue(), "Unsent B draft");
        await page.evaluate(() => window.e11.emit(1, "B survives A Stop"));
        await page.getByText(/B survives A Stop/).first().waitFor();
        assert.deepEqual(await page.evaluate(() => window.e11.requests.map(request => request.aborted)), [true, false]);
        await page.evaluate(() => window.e11.finish(1));
    });
    await test("production Agent-owned generation worker continues after its view unmounts", async () => {
        const batch = await page.evaluate(() => window.e11.prepareBatch());
        await go("/batch"); await page.getByRole("button", {name: "打开批量生成：E11 real batch", exact: true}).click();
        await page.getByRole("button", {name: "继续处理", exact: true}).click();
        await page.waitForFunction(() => window.e11.generation.some(request => request.method === "GET"));
        await go("/settings"); await go(`/agent/${ids.c}`); await composer().waitFor();
        assert.deepEqual(await page.evaluate(id => window.e11.execution(id), ids.c), {active: true, kind: "videoBatch"});
        await page.getByRole("button", {name: "停止", exact: true}).last().waitFor();
        assert.equal(await page.getByRole("alertdialog").count(), 0);
        assert.equal(await page.evaluate(() => window.e11.generation.filter(request => request.method === "POST").length), 1);
        assert.equal(await page.evaluate(() => window.e11.generation.some(request => request.aborted)), false);
        await page.evaluate(() => window.e11.releaseGeneration());
        await page.waitForFunction(batch => window.e11.db.agentGenerationJobs.where("batchId").equals(batch).toArray().then(rows => rows.some(row => row.status === "downloaded")), batch);
        await go("/batch");
        assert.equal(await page.evaluate(() => window.e11.generation.filter(request => request.method === "POST").length), 1);
    });
    await test("late home creation keeps the same mounted task board and its later draft", async () => {
        await go(`/agent/${ids.a}`); await composer().waitFor(); await go("/agent"); await composer().waitFor();
        await page.evaluate(() => window.e11.holdCreation());
        await composer().fill("Delayed home payload"); await page.getByRole("button", {name: "发送", exact: true}).click();
        await page.waitForFunction(() => window.e11.creationEntered());
        await go("/agent/tasks");
        await page.evaluate(() => window.e11.releaseCreation());
        await page.waitForFunction(() => window.e11.requests.length === 3);
        assert.equal(await page.evaluate(() => window.e11.route()), "/agent/tasks");
        await go(`/agent/${ids.b}`); await composer().fill("B untouched by late home receipt");
        await page.evaluate(() => window.e11.finish(2));
        await go("/agent/tasks"); await go(`/agent/${ids.b}`); await composer().waitFor();
        assert.equal(await composer().inputValue(), "B untouched by late home receipt");
        assert.equal(await page.evaluate(() => window.e11.requests.length), 3);
    });
    await test("saved approval attaches quietly and only an explicit decision authorizes continuation", async () => {
        const approval = await page.evaluate(() => window.e11.prepareApproval());
        await go(`/agent/${approval.threadId}`); await page.getByRole("button", {name: "批准", exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.e11.requests.length), 3);
        await go("/settings"); await go(`/agent/${approval.threadId}`);
        assert.equal(await page.evaluate(() => window.e11.requests.length), 3);
        await page.getByRole("button", {name: "拒绝", exact: true}).click();
        await page.waitForFunction(id => window.e11.db.agentToolCalls.get(id).then(call => call?.status === "rejected"), approval.callId);
        await page.waitForFunction(() => window.e11.requests.length === 4);
        await go("/settings"); assert.equal(await page.evaluate(() => window.e11.requests[3].aborted), false);
        await page.evaluate(() => window.e11.finish(3));
    });
    await test("AI wrapup continues detached while manual summary edits keep their real departure guard", async () => {
        await go("/wrapup"); await page.getByRole("button", {name: "AI 整理总结", exact: true}).click();
        await page.waitForFunction(() => window.e11.wrapup.requests === 1); await go("/settings");
        assert.equal(await page.getByRole("alertdialog").count(), 0);
        assert.equal(await page.evaluate(() => window.e11.wrapup.aborted), false);
        await page.evaluate(() => window.e11.wrapup.release());
        await page.waitForFunction(() => window.e11.db.agentTaskWrapups.where("taskId").equals(window.e11.wrapupTask.id).toArray().then(rows => rows.some(row => row.status === "draft")));
        await go("/wrapup"); await page.getByText("E11 retained AI summary", {exact: true}).waitFor();
        await page.getByRole("button", {name: "编辑", exact: true}).click();
        await page.getByRole("textbox", {name: "总结", exact: true}).fill("Manual edits remain protected");
        await page.evaluate(() => {void window.e11.navigate("/settings");}); await page.getByRole("alertdialog").waitFor();
        await page.getByRole("button", {name: "继续编辑", exact: true}).click();
        assert.equal(await page.getByRole("textbox", {name: "总结", exact: true}).inputValue(), "Manual edits remain protected");
        assert.equal(await page.evaluate(() => window.e11.wrapup.requests), 1);
    });
    await writeFile(join(output, "result.json"), JSON.stringify({status: "PASS", checks, errors, browser: browser.version(),
        limits: "Actual routed Agent/Settings/Project UI, IndexedDB and generation runtime; controlled local HTTP only. Chromium fixture does not establish packaged/native hidden scheduling."}, null, 2));
    console.log(`E11 evidence: ${output}`);
} catch (cause) {
    if (page) {await page.screenshot({path: join(output, "failure.png"), fullPage: true}); await writeFile(join(output, "failure.html"), await page.content());}
    await writeFile(join(output, "result.json"), JSON.stringify({status: "FAIL", checks, errors, error: String(cause)}, null, 2));
    console.error(`E11 evidence: ${output}`); throw cause;
} finally {await browser?.close(); await server.close(); await rm(cacheDir, {recursive: true, force: true});}
