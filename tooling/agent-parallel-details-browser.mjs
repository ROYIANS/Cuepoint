import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {prepareNativeFixture} from "./native-fixture-ready.mjs";

const {chromium} = await import(process.env.PARALLEL_PLAYWRIGHT_PATH ?? "playwright");
const cacheDir = await mkdtemp(join(tmpdir(), "agent-parallel-vite-"));
const output = process.env.PARALLEL_EVIDENCE_DIR ?? await mkdtemp(join(tmpdir(), "agent-parallel-evidence-"));
await mkdir(output, {recursive: true});
const fixture = "/tests/fixtures/agent-parallel-details/";
const controlledPersistence = {name: "parallel-controlled-manual-save", enforce: "pre", transform(source, id) {
    if (!id.endsWith("/packages/studio/src/features/video/commands/shots.ts")) return;
    const signature = "export async function patchShot(";
    assert(source.includes(signature), "Manual persistence seam must reach its actual command");
    return source.replace(signature, "async function acceptancePatchShot(") + `
export async function patchShot(...args: Parameters<typeof acceptancePatchShot>) {
    const fixture = (window as Window & {__parallelBeforeSave?: (id: string, patch: object, baseline?: unknown) => Promise<void>}).__parallelBeforeSave;
    await fixture?.(args[0], args[1], args[2]);
    return acceptancePatchShot(...args);
}
`;
}};
const server = await createServer({configFile: false, cacheDir, publicDir: fileURLToPath(new URL("../packages/distribution/public", import.meta.url)),
    plugins: [controlledPersistence, react(), tailwindcss()],
    optimizeDeps: {holdUntilCrawlEnd: false, entries: [fileURLToPath(new URL(`..${fixture}index.html`, import.meta.url))]},
    resolve: {alias: {"@": fileURLToPath(new URL("../packages/studio/src", import.meta.url))}},
    server: {host: "127.0.0.1", port: 0, strictPort: false, hmr: false, watch: {ignored: ["**/.trellis/**"]}}});
const observations = [], errors = [], documents = [], external = [];
let browser, page, url;
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceInputs = ["tooling/agent-parallel-details-browser.mjs", "tests/fixtures/agent-parallel-details/harness.tsx",
    "packages/studio/src/app/layout/context-panel.tsx", "packages/studio/src/app/layout/AppFrame.tsx", "packages/studio/src/app/details/ShotDetails.tsx",
    "packages/studio/src/features/video/ui/ShotDetailPanel.tsx", "packages/studio/src/features/agent/ui/AgentChatPage.tsx", "packages/studio/src/app/layout/ContextPanelHost.tsx", "packages/studio/src/ui/theme.css",
    "packages/studio/src/features/agent/ui/AgentMarkdown.tsx", "packages/studio/src/features/video/ui/DurationInput.tsx",
    "packages/studio/src/app/drafts/TextDraftField.tsx", "packages/studio/src/features/video/commands/shots.ts", "packages/studio/src/app/details/shotDetailTarget.ts",
    "packages/studio/src/features/library/ui/GenerationSlotCard.tsx", "packages/studio/src/features/agent/ui/CreatedEntityLinks.tsx",
    "packages/studio/src/features/agent/ui/GenerationReview.tsx", "packages/studio/src/features/agent/ui/AgentGenerationResults.tsx",
    "packages/studio/src/features/agent/ui/ProjectImageSources.tsx", "packages/studio/src/features/agent/ui/TaskWrapup.tsx",
    "packages/studio/src/features/agent/ui/AgentRunDetails.tsx", "packages/studio/src/features/agent/ui/ThinkingPanel.tsx", "packages/studio/src/features/agent/ui/MessageList.tsx"];
const sources = await Promise.all(sourceInputs.map(async path => ({path, sha256: sha256(await readFile(path))})));
const record = async status => writeFile(join(output, "result.json"), JSON.stringify({status, observations, errors, documents, external, sources,
    browser: browser?.version(), node: process.version,
    limits: "Actual shared React UI and IndexedDB with deterministic streaming HTTP and pre-command manual-save gates. Original production commands run after controlled gates; no transaction internals are replaced. The palette composes real nonmodal Agent surfaces alongside AgentChatPage; it is a controlled fixture, not the unmodified product root, a paid provider, WebKit or packaged native acceptance."}, null, 2) + "\n");
try {
    await server.listen();
    await prepareNativeFixture(server, `${fixture}harness.tsx`);
    browser = await chromium.launch({headless: true, ...(process.env.PARALLEL_CHROMIUM_PATH ? {executablePath: process.env.PARALLEL_CHROMIUM_PATH} : {})});
    page = await browser.newPage({viewport: {width: 1440, height: 900}});
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {if (request.resourceType() === "document" && request.frame() === page.mainFrame()) documents.push(request.url());});
    const origin = server.resolvedUrls.local[0];
    await page.route("**/*", async route => {
        const requestUrl = route.request().url();
        if (requestUrl.startsWith(origin) || requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) return route.continue();
        external.push(requestUrl);
        return route.abort("blockedbyclient");
    });
    url = origin + fixture.slice(1);
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.parallel));
    const ids = await page.evaluate(() => ({thread: window.parallel.thread.id, shots: window.parallel.shots.map(shot => shot.id)}));
    const expectedRoute = `/agent/${ids.thread}`;
    const panel = () => page.locator('[data-slot="context-panel-content"]');
    const editor = () => page.locator("[data-shot-detail]");
    const composer = () => page.getByRole("textbox", {name: "消息内容", exact: true});
    const palette = () => page.locator("[data-acceptance-surface]");
    const prompt = () => page.getByRole("alertdialog");
    const test = async (name, action) => {
        try {
            await action();
            assert.deepEqual(errors, [], "Browser errors fail acceptance");
            assert.deepEqual(documents, [url], "Only the initial main document is allowed");
            observations.push({name, outcome: "pass"});
            console.log(`PASS ${name}`);
        } catch (error) {
            observations.push({name, outcome: "fail", error: String(error)});
            await page.screenshot({path: join(output, "failure.png"), fullPage: true});
            await writeFile(join(output, "failure.html"), await page.content());
            await record("FAIL");
            throw error;
        }
    };
    const assertRunning = async (text = "continuing") => {
        const before = await page.evaluate(() => window.parallel.current());
        assert.equal(before.route, expectedRoute);
        assert.equal(before.requests.length, 1, "One real dispatch for the live run");
        assert.equal(before.requests[0].aborted, false, "Original transport signal remains live");
        const active = before.runs.find(run => run.status === "running");
        assert(active, "Original run is still running");
        const marker = `[acceptance ${text} ${before.sequence}] `;
        await page.evaluate(value => window.parallel.emit(value), marker);
        await page.waitForFunction(({id, marker}) => window.parallel.db.chatMessages.get(id).then(message => message?.content.includes(marker)), {id: active.assistantMessageId, marker});
        const after = await page.evaluate(() => window.parallel.current());
        assert.equal(after.runs.find(run => run.status === "running")?.id, active.id);
        assert.equal(after.requests.length, 1);
        assert.equal(after.requests[0].aborted, false);
        assert.equal(await prompt().count(), 0, "No stop or draft prompt during clean inspection");
    };
    const close = async () => {
        const back = panel().getByRole("button", {name: "返回对话", exact: true});
        if (await back.isVisible()) await back.click();
        else await panel().getByRole("button", {name: "关闭", exact: true}).click();
        await panel().waitFor({state: "hidden"});
    };
    const setSurface = async name => {
        await page.evaluate(name => window.parallel.surface(name), name);
        await page.locator(`[data-acceptance-surface="${name}"]`).waitFor();
    };
    await test("real AgentChatPage starts one deterministic streaming request", async () => {
        await composer().fill("Start one continuous offline acceptance reply");
        await page.getByRole("button", {name: "发送", exact: true}).click();
        await page.waitForFunction(() => window.parallel.requests.length === 1);
        await assertRunning("initial");
        await composer().fill("Unsent composer draft remains exact.\n第二行");
    });
    await test("actual transcript Markdown pointer opens an owned shot and stream continues", async () => {
        await page.getByRole("link", {name: "Transcript shot", exact: true}).click();
        await page.locator(`[data-shot-detail="${ids.shots[0]}"]`).waitFor();
        assert.equal(await panel().getAttribute("data-mode"), "docked");
        assert.equal(await panel().getAttribute("aria-modal"), null);
        await assertRunning("markdown");
        assert.equal(await composer().inputValue(), "Unsent composer draft remains exact.\n第二行");
        await close();
    });
    for (const [name, link] of [["flat", "查看Receipt shot 1 ↗"], ["single", "Single historical shot ↗"], ["hash", "Native hash shot"], ["collapsed", "Receipt shot 1"], ["preview", "查看Preview shot ↗"],
        ["review", "Review shot"], ["result", "查看分镜 ↗"], ["provenance", /Provenance shot/], ["reasoning", "Reasoning shot"], ["activity", "Activity shot"], ["wrapup", "打开成果"]]) {
        await test(`real ${name} surface pointer and Enter retain running Agent`, async () => {
            await setSurface(name);
            if (name === "collapsed") await palette().getByRole("button", {name: "3 项明细"}).click();
            if (name === "wrapup") await palette().getByText("查看依据", {exact: false}).first().click();
            if (name === "preview") await palette().locator(".agent-tool-call-toggle").first().click();
            const anchor = palette().getByRole("link", {name: link, exact: typeof link === "string"}).first();
            assert.equal(await anchor.getAttribute("href"), await page.evaluate(name => (name === "hash" ? "#" : "") + window.parallel.href(0), name), "Canonical href remains copyable");
            await anchor.click();
            await page.locator(`[data-shot-detail="${ids.shots[0]}"]`).waitFor();
            await assertRunning(`${name}-pointer`); await close();
            await anchor.focus(); await page.keyboard.press("Enter");
            await page.locator(`[data-shot-detail="${ids.shots[0]}"]`).waitFor();
            await assertRunning(`${name}-enter`); await close();
        });
    }
    await test("real TaskInspector follows full-width mode, returns and cleanly yields to shot detail", async () => {
        await page.evaluate(() => window.parallel.surface(""));
        const openTask = page.locator(".agent-composer-task-summary button").first();
        await openTask.click();
        await panel().getByRole("heading", {name: "Acceptance task", exact: true}).waitFor();
        await page.setViewportSize({width: 760, height: 520});
        await page.waitForFunction(() => document.querySelector('[data-slot="context-panel-content"]')?.getAttribute("data-mode") === "full-width");
        await panel().getByRole("button", {name: "返回工作区", exact: true}).click();
        await panel().waitFor({state: "hidden"});
        await page.setViewportSize({width: 1440, height: 900});
        await openTask.click();
        await panel().getByRole("heading", {name: "Acceptance task", exact: true}).waitFor();
        await setSurface("targets");
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        await page.locator(`[data-shot-detail="${ids.shots[0]}"]`).waitFor();
        assert.equal(await panel().count(), 1, "One active shared inspector");
        await assertRunning("inspector-replacement"); await close();
    });
    await test("native modified anchor intent is not converted to in-place detail", async () => {
        await setSurface("targets");
        const anchor = palette().getByRole("link", {name: "Shot A", exact: true});
        const result = await anchor.evaluate(element => {
            const event = new MouseEvent("click", {bubbles: true, cancelable: true, ctrlKey: true, button: 0});
            // Observe cancellation synchronously, then suppress the browser default only
            // in this fixture to avoid opening an uncontrolled tab.
            let prevented;
            document.addEventListener("click", current => {prevented = current.defaultPrevented; current.preventDefault();}, {once: true});
            element.dispatchEvent(event);
            return prevented;
        });
        assert.equal(result, false, "Modified click stays native before fixture-only default suppression");
        assert.equal(await panel().count(), 0);
        await assertRunning("modified");
    });
    await test("single editor survives dock/full-width resizing and preserves input caret", async () => {
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        const content = editor().getByRole("textbox", {name: "镜头内容", exact: true});
        await content.fill("Locally edited shot text");
        await content.evaluate(element => {element.focus(); element.setSelectionRange(4, 10); window.parallelEditorNode = element;});
        for (const viewport of [{width: 1024, height: 640}, {width: 760, height: 520}, {width: 390, height: 720}, {width: 1440, height: 900}]) {
            await page.setViewportSize(viewport);
            const mode = viewport.width === 1440 ? "docked" : "full-width";
            await page.waitForFunction(mode => document.querySelector('[data-slot="context-panel-content"]')?.getAttribute("data-mode") === mode, mode);
            assert.equal(await content.evaluate(element => element === window.parallelEditorNode), true, "Same real DOM editor across presentation modes");
            assert.equal(await content.inputValue(), "Locally edited shot text");
            assert.deepEqual(await content.evaluate(element => [element.selectionStart, element.selectionEnd]), [4, 10]);
            const geometry = await page.evaluate(() => {
                const surface = document.querySelector(".app-working-surface").getBoundingClientRect();
                const panel = document.querySelector('[data-slot="context-panel-content"]').getBoundingClientRect();
                const workspace = document.querySelector("[data-context-panel-workspace]");
                return {surface: {x: surface.x, width: surface.width}, panel: {x: panel.x, width: panel.width}, inert: workspace.inert, docWidth: document.documentElement.scrollWidth, viewport: innerWidth};
            });
            assert(geometry.docWidth <= geometry.viewport + 1, "No document horizontal overflow");
            if (mode === "full-width") {
                assert(Math.abs(geometry.surface.width - geometry.panel.width) <= 2); assert.equal(geometry.inert, true);
                const visibleChatPaint = await page.locator("[data-context-panel-workspace] *").evaluateAll(elements => elements.filter(element => {
                    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
                    let transparentAncestor = false;
                    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
                        if (getComputedStyle(ancestor).opacity === "0") {transparentAncestor = true; break;}
                    }
                    return rect.width > 0 && rect.height > 0 && style.visibility === "visible" && style.display !== "none" && !transparentAncestor;
                }).map(element => ({tag: element.tagName, className: element.className, text: element.textContent.slice(0, 80)})));
                assert.deepEqual(visibleChatPaint, [], "Hidden conversation descendants must not paint over full-width detail");
            }
            else {assert(geometry.panel.width < geometry.surface.width); assert.equal(geometry.inert, false);}
            assert.equal(await page.locator('[data-slot="context-panel-overlay"]').count(), 0);
            await assertRunning(`resize-${viewport.width}`);
            await page.screenshot({path: join(output, `viewport-${viewport.width}.png`)});
        }
        await page.waitForFunction(id => window.parallel.db.shots.get(id).then(shot => shot?.content === "Locally edited shot text"), ids.shots[0]);
        await editor().locator('[data-text-draft$=":content"]').getByRole("status").filter({hasText: "已保存"}).waitFor();
        await close();
        assert.equal(await composer().inputValue(), "Unsent composer draft remains exact.\n第二行");
    });
    await test("wide conversation and shot detail retain independent scrollports", async () => {
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        await page.locator(`[data-shot-editor="${ids.shots[0]}"]`).waitFor();
        const list = page.locator(".agent-message-list"), detail = page.locator("[data-shot-detail-scroll]");
        await list.evaluate(element => {element.scrollTop = 65; element.dispatchEvent(new Event("scroll", {bubbles: true}));});
        const reading = await list.evaluate(element => element.scrollTop);
        await detail.evaluate(element => {element.scrollTop = 250;});
        assert.equal(await list.evaluate(element => element.scrollTop), reading);
        const editing = await detail.evaluate(element => element.scrollTop);
        assert(editing > 0, "Actual detail scrollport scrolls");
        await list.evaluate(element => {element.scrollTop = 125; element.dispatchEvent(new Event("scroll", {bubbles: true}));});
        assert.equal(await detail.evaluate(element => element.scrollTop), editing);
        const externalLink = page.getByRole("link", {name: "External reference", exact: true});
        assert.equal(await externalLink.getAttribute("href"), "https://example.com/parallel");
        assert.equal(await externalLink.getAttribute("target"), "_blank");
        await close(); await assertRunning("independent-scroll");
    });
    await test("full-width return preserves a deliberate older transcript reading position", async () => {
        await page.setViewportSize({width: 760, height: 520});
        const list = page.locator(".agent-message-list");
        await list.evaluate(element => {element.scrollTop = 50; element.dispatchEvent(new Event("scroll", {bubbles: true}));});
        const before = await list.evaluate(element => element.scrollTop);
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        await panel().getByRole("button", {name: "返回对话", exact: true}).waitFor();
        await assertRunning("hidden-chat");
        await close();
        assert.equal(await list.evaluate(element => element.scrollTop), before);
        assert.equal(await composer().inputValue(), "Unsent composer draft remains exact.\n第二行");
        await page.setViewportSize({width: 1440, height: 900});
    });
    await test("invalid numeric draft protects same-registration A to B and cancel restores A", async () => {
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        const duration = editor().getByRole("textbox", {name: "时长（秒）", exact: true});
        await duration.fill("invalid-duration");
        await palette().getByRole("link", {name: "Shot B", exact: true}).click();
        await prompt().waitFor();
        await prompt().getByRole("button", {name: "继续编辑", exact: true}).click();
        assert.equal(await editor().getAttribute("data-shot-detail"), ids.shots[0]);
        assert.equal(await duration.inputValue(), "invalid-duration");
        await duration.fill("8.5");
        await page.waitForFunction(id => window.parallel.db.shots.get(id).then(shot => shot?.durationSec === 8.5), ids.shots[0]);
        await page.waitForFunction(() => {const pane = document.querySelector("[data-shot-detail]"); return pane?.getAttribute("aria-busy") === "false" && !pane?.getAttribute("data-unsaved-fields");});
        await palette().getByRole("link", {name: "Shot B", exact: true}).click();
        await page.locator(`[data-shot-detail="${ids.shots[1]}"]`).waitFor();
        await close(); await assertRunning("guard");
    });
    await test("pending save retains A and same-field remote conflict preserves both values", async () => {
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        const content = editor().getByRole("textbox", {name: "镜头内容", exact: true});
        await page.evaluate(() => window.parallel.holdSave("content"));
        const before = await page.evaluate(() => window.parallel.manualWrites.length);
        await content.fill("Manual competing draft");
        await page.waitForFunction(count => window.parallel.manualWrites.length > count, before);
        await palette().getByRole("link", {name: "Shot B", exact: true}).click();
        await prompt().waitFor();
        assert.equal(await prompt().getByRole("button", {name: "放弃并离开", exact: true}).count(), 0, "Pending write cannot be discarded");
        await prompt().getByRole("button", {name: "继续编辑", exact: true}).click();
        assert.equal(await editor().getAttribute("data-shot-detail"), ids.shots[0]);
        await page.evaluate(() => window.parallel.remotePatch(0, {content: "Remote competing value"}));
        await page.evaluate(() => window.parallel.releaseSave("content"));
        await editor().getByRole("alert").filter({hasText: /修改|冲突|变化/}).waitFor();
        assert.equal(await content.inputValue(), "Manual competing draft");
        assert.equal(await page.evaluate(() => window.parallel.db.shots.get(window.parallel.shots[0].id).then(shot => shot.content)), "Remote competing value");
        await editor().getByRole("button", {name: "采用最新内容", exact: true}).click();
        await page.waitForFunction(() => {const pane = document.querySelector("[data-shot-detail]"); return pane?.getAttribute("aria-busy") === "false" && !pane?.getAttribute("data-unsaved-fields");});
        assert.equal(await content.inputValue(), "Remote competing value");
        await close(); await assertRunning("concurrent-conflict");
    });
    await test("existing media edit session survives resize and saves only its frozen shot slot", async () => {
        await palette().getByRole("link", {name: "Shot A", exact: true}).click();
        await editor().getByRole("button", {name: "镜头 P1 · 首帧", exact: true}).click();
        const dialog = page.getByRole("dialog", {name: "镜头 P1 · 首帧", exact: true});
        const promptField = dialog.getByRole("textbox", {name: "画面描述 / 提示词", exact: true});
        await promptField.fill("Frozen A media prompt");
        await promptField.evaluate(element => {window.parallelMediaNode = element; element.setSelectionRange(2, 6);});
        await page.setViewportSize({width: 760, height: 520});
        assert.equal(await promptField.evaluate(element => element === window.parallelMediaNode), true);
        assert.equal(await promptField.inputValue(), "Frozen A media prompt");
        assert.deepEqual(await promptField.evaluate(element => [element.selectionStart, element.selectionEnd]), [2, 6]);
        await assertRunning("media-dialog");
        await page.evaluate(() => window.parallel.remotePatch(0, {notes: "Independent remote note"}));
        await dialog.getByRole("button", {name: "保存", exact: true}).click();
        await dialog.waitFor({state: "hidden"});
        await page.waitForFunction(() => window.parallel.db.shots.get(window.parallel.shots[0].id).then(shot => shot?.firstFrame.prompt === "Frozen A media prompt"));
        assert.deepEqual(await page.evaluate(async () => {
            const [a, b] = await window.parallel.db.shots.bulkGet(window.parallel.shots.slice(0, 2).map(shot => shot.id));
            return {a: a.firstFrame.prompt, note: a.notes, b: b.firstFrame.prompt};
        }), {a: "Frozen A media prompt", note: "Independent remote note", b: ""});
        await page.waitForFunction(() => {const pane = document.querySelector("[data-shot-detail]"); return pane?.getAttribute("aria-busy") === "false" && !pane?.getAttribute("data-unsaved-fields");});
        await close(); await page.setViewportSize({width: 1440, height: 900});
        await assertRunning("media-saved");
    });
    await test("missing and foreign ownership stay local; inspecting never clears episode filters", async () => {
        for (const name of ["Missing shot", "Foreign shot"]) {
            await palette().getByRole("link", {name, exact: true}).click();
            await panel().getByText(/找不到|不存在|不属于/).first().waitFor();
            assert.equal(await panel().getByRole("textbox").count(), 0);
            await assertRunning(name); await close();
        }
        assert.deepEqual(await page.evaluate(() => window.parallel.db.episodes.get(window.parallel.episode.id).then(episode => episode.shotFilters)), await page.evaluate(() => window.parallel.filters));
    });
    await test("genuine route departure still asks and cancel leaves original stream alive", async () => {
        await page.evaluate(() => {void window.parallel.navigate("/projects");});
        await prompt().waitFor();
        assert.match(await prompt().innerText(), /停止|离开/);
        await prompt().getByRole("button", {name: /继续|留在|取消/}).click();
        await prompt().waitFor({state: "hidden"});
        await assertRunning("cancel-navigation");
        await page.evaluate(() => window.parallel.finish());
        await page.waitForFunction(() => window.parallel.db.agentRuns.where("threadId").equals(window.parallel.thread.id).toArray().then(runs => runs.some(run => run.status === "completed")));
        assert.equal(await page.evaluate(() => window.parallel.requests.length), 1);
    });
    await test("consumed acceptance sources retain their starting identities", async () => {
        for (const input of sources) assert.equal(sha256(await readFile(input.path)), input.sha256, `Source changed during acceptance: ${input.path}`);
    });
    await record("PASS");
    console.log(JSON.stringify({status: "PASS", scenarios: observations.length, output}));
} catch (error) {
    await record("FAIL");
    console.error(`Acceptance evidence: ${output}`);
    throw error;
} finally {
    await browser?.close();
    await server.close();
    await rm(cacheDir, {recursive: true, force: true});
}
