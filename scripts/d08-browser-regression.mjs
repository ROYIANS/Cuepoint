import assert from "node:assert/strict";
import {readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const {chromium} = await import(process.env.D08_PLAYWRIGHT_PATH ?? "playwright");
const commands = {"/src/db/shots.ts": "patchShot", "/src/db/episodes.ts": "patchStoryBeat"};
const originals = ["src/components/shots/ShotRow.tsx", "src/components/shots/ShotEditorPage.tsx", "src/components/story/StoryPage.tsx", "src/db/episodes.ts"];
const transport = {name: "d08-controlled-storage", enforce: "pre", async transform(source, id) {
    if (process.env.D08_BASELINE_ROOT) {
        const path = originals.find(path => id.endsWith(`/${path}`));
        if (path) source = await readFile(join(process.env.D08_BASELINE_ROOT, path), "utf8");
    }
    for (const [suffix, command] of Object.entries(commands)) {
        if (id.endsWith(suffix)) {
            source = source.replace(`export async function ${command}(`, `async function _d08_${command}(`);
            source += `\nexport async function ${command}(...args: Parameters<typeof _d08_${command}>) {
                const fixture = typeof window === "undefined" ? undefined : window.d08;
                if (fixture) {
                    fixture.calls.push({command: "${command}", args});
                    await fixture.wait("${command}");
                    if (fixture.failures.has("${command}")) throw new Error("fixture ${command} storage failure");
                }
                return _d08_${command}(...args);
            }`;
        }
    }
    return source;
}};
const server = await createServer({configFile: false, plugins: [transport, react(), tailwindcss()],
    resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 0}});
let browser;
const report = {unit: "D08/PU06", baseline: Boolean(process.env.D08_BASELINE_ROOT), status: "running", checks: [], errors: [], externalRequests: 0, downloads: 0,
    limits: "Actual React pages/router/guards/Dexie/native IndexedDB; controlled command delay/failure, synthetic composition input and force-remount seam. No paid-provider, crash/browser-restart, OS IME, or unmodified full-product E2E claim."};
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.D08_CHROMIUM_PATH ? {executablePath: process.env.D08_CHROMIUM_PATH} : {})});
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, acceptDownloads: true});
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => {report.errors.push(error.message);});
    page.on("download", () => {report.downloads++;});
    await page.route("**/*", route => {
        if (new URL(route.request().url()).hostname !== "127.0.0.1") {report.externalRequests++; return route.abort();}
        return route.continue();
    });
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/d08/");
    await page.waitForFunction(() => Boolean(window.d08));
    const ids = await page.evaluate(() => ({a: {project: window.d08.a.project.id, episode: window.d08.a.episode.id, beat: window.d08.a.beat.id, shot: window.d08.a.shot.id},
        b: {project: window.d08.b.project.id, episode: window.d08.b.episode.id, beat: window.d08.b.beat.id, shot: window.d08.b.shot.id}}));
    const shotPath = owner => `/p/${ids[owner].project}/e/${ids[owner].episode}/shots`;
    const storyPath = owner => `/p/${ids[owner].project}/e/${ids[owner].episode}`;
    const navigate = async path => {
        await page.waitForFunction(() => window.d08.router.history._getBlockers().every(blocker => blocker.enableBeforeUnload !== true));
        await page.evaluate(path => window.d08.navigate(path), path);
        await page.waitForFunction(path => window.d08.location() === path, path);
    };
    const row = () => page.locator(`#shot-${ids.a.shot}`);
    const shotField = (label = "备注") => report.baseline ? row().getByPlaceholder(label) : row().getByRole("textbox", {name: label, exact: true});
    const beatField = (field = "title") => page.locator(`[data-text-draft="episode:${ids.a.episode}:beat:${ids.a.beat}:${field}"]`).getByRole("textbox");
    const hold = key => page.evaluate(key => window.d08.hold(key), key);
    const release = key => page.evaluate(key => window.d08.release(key), key);
    const flush = scope => page.evaluate(scope => window.d08.flush(scope), scope);
    const expectValue = async (field, value) => {
        await page.waitForFunction(({selector, value}) => document.querySelector(selector)?.value === value, {selector: await field.evaluate(el => {
            const owner = el.closest("[data-text-draft]"); return `[data-text-draft="${owner.dataset.textDraft}"] ${el.tagName.toLowerCase()}`;
        }), value});
    };
    const test = async (name, run) => {
        await run(); assert.deepEqual(report.errors, []); assert.equal(report.externalRequests, 0);
        report.checks.push({name, status: "PASS"}); console.error(`PASS ${name}`);
    };
    await navigate(shotPath("a")); await shotField().waitFor();
    if (report.baseline) {
        await test("original direct write has no project draft/backup barrier while storage is delayed", async () => {
            await hold("patchShot"); await shotField().fill("original delayed text");
            await page.waitForFunction(() => window.d08.calls.some(call => call.command === "patchShot"));
            await flush(ids.a.project);
            assert.equal(await page.evaluate(id => window.d08.db.shots.get(id).then(row => row.notes), ids.a.shot), "A备注");
            assert.equal(await row().locator("[data-text-draft]").count(), 0);
            await release("patchShot");
            await page.waitForFunction(id => window.d08.db.shots.get(id).then(row => row.notes === "original delayed text"), ids.a.shot);
        });
    } else {
        await test("immediate local text, original baseline, serialized newest value and unrelated live merge", async () => {
            await hold("patchShot"); await shotField().fill("first delayed"); assert.equal(await shotField().inputValue(), "first delayed");
            await page.waitForFunction(() => window.d08.calls.some(call => call.command === "patchShot"));
            const first = await page.evaluate(() => window.d08.calls.find(call => call.command === "patchShot"));
            assert.deepEqual(first.args[2], {notes: "A备注"});
            await page.evaluate(id => window.d08.db.shots.update(id, {durationSec: 4}), ids.a.shot);
            await shotField().fill("newest delayed"); assert.equal(await shotField().inputValue(), "newest delayed");
            await release("patchShot"); await flush(ids.a.project);
            assert.deepEqual(await page.evaluate(id => window.d08.db.shots.get(id).then(row => ({notes: row.notes, duration: row.durationSec})), ids.a.shot), {notes: "newest delayed", duration: 4});
            assert.equal(await shotField().inputValue(), "newest delayed");
        });
        await test("same-field conflict stays visible through retry, explicit latest then merge", async () => {
            await hold("patchShot"); await shotField().fill("local conflict");
            await page.evaluate(id => window.d08.db.shots.update(id, {notes: "remote notes"}), ids.a.shot);
            assert.equal(await shotField().inputValue(), "local conflict"); await release("patchShot");
            await row().getByRole("alert").filter({hasText: "其他页面"}).waitFor();
            await row().getByRole("button", {name: "重试", exact: true}).click();
            await row().getByRole("alert").filter({hasText: "其他页面"}).waitFor();
            assert.equal(await shotField().inputValue(), "local conflict");
            await row().getByRole("button", {name: "采用最新内容", exact: true}).click(); await expectValue(shotField(), "remote notes");
            await shotField().fill("merged notes"); await flush(ids.a.project);
            assert.equal(await page.evaluate(id => window.d08.db.shots.get(id).then(row => row.notes), ids.a.shot), "merged notes");
        });
        await test("actual project backup blocks failure, retry persists and download contains latest text", async () => {
            await page.evaluate(() => window.d08.failures.add("patchShot")); await shotField().fill("backup latest");
            const before = report.downloads;
            await page.getByRole("button", {name: "备份项目", exact: true}).click();
            await page.getByText(/备份失败：fixture patchShot storage failure/).waitFor();
            assert.equal(report.downloads, before); assert.equal(await shotField().inputValue(), "backup latest");
            await page.evaluate(() => window.d08.failures.delete("patchShot")); await row().getByRole("button", {name: "重试", exact: true}).click();
            await flush(ids.a.project);
            const download = page.waitForEvent("download"); await page.getByRole("button", {name: "备份项目", exact: true}).click();
            const saved = await download; const bytes = await readFile(await saved.path());
            const {default: JSZip} = await import("jszip"); const zip = await JSZip.loadAsync(bytes);
            const entry = Object.keys(zip.files).find(name => name.endsWith("shots.json")); assert.ok(entry);
            const rows = JSON.parse(await zip.file(entry).async("string")); assert.equal(rows.find(row => row.id === ids.a.shot).notes, "backup latest");
        });
        await test("pending route departure remains on original owner and permits switching only after save", async () => {
            await hold("patchShot"); await shotField().fill("A owner final");
            await page.evaluate(path => window.d08.navigate(path), shotPath("b"));
            await page.getByRole("alertdialog").filter({hasText: "正在处理修改"}).waitFor();
            assert.equal(await page.evaluate(() => window.d08.location()), shotPath("a"));
            assert.equal(await page.getByRole("button", {name: "放弃并离开", exact: true}).count(), 0);
            await page.getByRole("button", {name: "继续编辑", exact: true}).click();
            await release("patchShot"); await flush(ids.a.project);
            await page.waitForFunction(id => document.querySelector(`#shot-${id} [data-text-draft$=":notes"] [role="status"]`)?.textContent === "已保存", ids.a.shot);
            await navigate(shotPath("b"));
            await page.locator(`#shot-${ids.b.shot}`).getByRole("textbox", {name: "备注", exact: true}).waitFor();
            assert.equal(await page.evaluate(id => window.d08.db.shots.get(id).then(row => row.notes), ids.b.shot), "B备注");
            await navigate(shotPath("a")); await expectValue(shotField(), "A owner final");
        });
        await test("synthetic IME composition preserves actual local Chinese text, focus and caret through live writes", async () => {
            await hold("patchShot"); const input = shotField("镜头内容"); await input.focus();
            await input.evaluate(el => {
                el.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true}));
                const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
                set.call(el, "前中文后"); el.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertCompositionText", data: "中文", isComposing: true}));
                el.setSelectionRange(3, 3);
            });
            await page.waitForFunction(() => window.d08.calls.some(call => call.command === "patchShot" && call.args[1].content === "前中文后"));
            await page.evaluate(id => window.d08.db.shots.update(id, {durationSec: 6}), ids.a.shot);
            await page.waitForFunction(id => document.querySelector(`#shot-${id} [aria-label="时长（秒）"]`)?.value === "6", ids.a.shot);
            assert.deepEqual(await input.evaluate(el => ({value: el.value, start: el.selectionStart, end: el.selectionEnd, focused: document.activeElement === el})), {value: "前中文后", start: 3, end: 3, focused: true});
            await input.evaluate(el => {
                el.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true, data: "中文"}));
                el.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: "中文"}));
            });
            await release("patchShot"); await flush(ids.a.project);
            assert.equal(await page.evaluate(id => window.d08.db.shots.get(id).then(row => row.content), ids.a.shot), "前中文后");
        });
        await test("offscreen dirty row remains mounted, clean row virtualizes and reopens persisted text", async () => {
            await hold("patchShot"); await shotField().fill("virtualized draft");
            const other = page.locator('[id^="shot-"]').nth(1); await other.click({position: {x: 10, y: 20}});
            await page.locator("[data-shot-scrollport]").evaluate(el => {el.scrollTop = el.scrollHeight;});
            await page.waitForFunction(id => {
                const scroll = document.querySelector("[data-shot-scrollport]"); const row = document.getElementById(`shot-${id}`);
                return scroll.scrollTop > 2000 && row.getBoundingClientRect().bottom < scroll.getBoundingClientRect().top - 640;
            }, ids.a.shot);
            assert.equal(await row().getAttribute("data-shot-mounted"), "true"); assert.equal(await shotField().inputValue(), "virtualized draft");
            await release("patchShot"); await flush(ids.a.project);
            await page.waitForFunction(id => document.getElementById(`shot-${id}`).dataset.shotMounted === "false", ids.a.shot);
            await page.locator("[data-shot-scrollport]").evaluate(el => {el.scrollTop = 0;}); await shotField().waitFor(); await expectValue(shotField(), "virtualized draft");
        });
        await test("missing shot retains readable draft, rejects backup/flush and retries on restored original row", async () => {
            await page.evaluate(async id => {window.d08.savedShot = await window.d08.db.shots.get(id);}, ids.a.shot);
            await hold("patchShot"); await shotField().fill("missing row local");
            await page.evaluate(id => window.d08.db.shots.delete(id), ids.a.shot);
            await page.getByRole("alert").filter({hasText: "不可用"}).waitFor(); assert.equal(await shotField().inputValue(), "missing row local");
            assert.equal(await shotField().getAttribute("readonly"), ""); await release("patchShot");
            await assert.rejects(flush(ids.a.project), /镜头不存在/);
            await row().getByRole("alert").filter({hasText: "镜头不存在"}).waitFor();
            await page.evaluate(() => window.d08.db.shots.put(window.d08.savedShot));
            await page.waitForFunction(id => !document.querySelector(`#shot-${id} [aria-label="备注"]`).readOnly, ids.a.shot);
            await row().getByRole("button", {name: "重试", exact: true}).click(); await flush(ids.a.project); await expectValue(shotField(), "missing row local");
        });
        await test("forced unmount keeps failed controller in barrier and reopening restores error/text", async () => {
            await page.evaluate(() => window.d08.failures.add("patchShot")); await shotField().fill("reopened local");
            await assert.rejects(flush(ids.a.project), /storage failure/);
            await page.evaluate(() => window.d08.detach()); await page.getByText("detached D08 fixture").waitFor();
            await assert.rejects(flush(ids.a.project), /storage failure/);
            await page.evaluate(() => window.d08.reopen()); await shotField().waitFor(); await expectValue(shotField(), "reopened local");
            await row().getByRole("alert").filter({hasText: "storage failure"}).waitFor();
            await page.evaluate(() => window.d08.failures.delete("patchShot")); await row().getByRole("button", {name: "重试", exact: true}).click(); await flush(ids.a.project);
        });
        await navigate(storyPath("a")); await beatField().waitFor();
        await test("StoryPage title/content/time text merge with live episode data and use original per-field baselines", async () => {
            await hold("patchStoryBeat"); await beatField().fill("new title"); await beatField("content").fill("new content"); await beatField("timeOfDay").fill("夜");
            await page.evaluate(id => window.d08.db.episodes.update(id, {title: "independent episode title"}), ids.a.episode);
            assert.equal(await beatField().inputValue(), "new title"); assert.equal(await beatField("content").inputValue(), "new content");
            await release("patchStoryBeat"); await flush(ids.a.project);
            const result = await page.evaluate(({episode, beat}) => window.d08.db.episodes.get(episode).then(row => ({title: row.title, beat: row.story.beats.find(row => row.id === beat)})), ids.a);
            assert.equal(result.title, "independent episode title"); assert.equal(result.beat.title, "new title"); assert.equal(result.beat.content, "new content"); assert.equal(result.beat.timeOfDay, "夜");
        });
        await test("missing beat remains visible with error and can retry after the original beat is restored", async () => {
            await page.evaluate(async id => {window.d08.savedEpisode = await window.d08.db.episodes.get(id);}, ids.a.episode);
            await hold("patchStoryBeat"); await beatField().fill("missing beat title");
            await page.evaluate(({episode, beat}) => window.d08.db.episodes.get(episode).then(row => window.d08.db.episodes.update(episode, {story: {...row.story, beats: row.story.beats.filter(row => row.id !== beat)}})), ids.a);
            await page.getByRole("alert").filter({hasText: "场次已不可用"}).waitFor(); assert.equal(await beatField().inputValue(), "missing beat title");
            await release("patchStoryBeat"); await assert.rejects(flush(ids.a.project), /场次不存在/);
            await page.evaluate(() => window.d08.db.episodes.put(window.d08.savedEpisode));
            await page.waitForFunction(key => !document.querySelector(`[data-text-draft="${key}"] input`).readOnly, `episode:${ids.a.episode}:beat:${ids.a.beat}:title`);
            await beatField().locator("..").getByRole("button", {name: "重试", exact: true}).click(); await flush(ids.a.project);
        });
        await test("missing episode and project keep the current beat text under the actual unavailable shell", async () => {
            for (const table of ["episodes", "projects"]) {
                const id = table === "episodes" ? ids.a.episode : ids.a.project;
                await page.evaluate(async ({table, id}) => {window.d08.savedOwner = await window.d08.db[table].get(id);}, {table, id});
                await hold("patchStoryBeat"); await beatField("content").fill(`missing ${table} local`);
                await page.evaluate(({table, id}) => window.d08.db[table].delete(id), {table, id});
                await page.getByRole("alert").filter({hasText: /不可用/}).first().waitFor(); assert.equal(await beatField("content").inputValue(), `missing ${table} local`);
                await release("patchStoryBeat"); await assert.rejects(flush(ids.a.project), /不存在/);
                await page.evaluate(({table}) => window.d08.db[table].put(window.d08.savedOwner), {table});
                await page.waitForFunction(key => !document.querySelector(`[data-text-draft="${key}"] textarea`).readOnly, `episode:${ids.a.episode}:beat:${ids.a.beat}:content`);
                await flush(ids.a.project);
            }
        });
        await test("all ten actual shot text controls persist independent field patches with baselines", async () => {
            await navigate(shotPath("a")); await shotField().waitFor(); await hold("patchShot");
            const fields = {shotNumber: "镜号", content: "镜头内容", notes: "备注", category: "类别", sound: "声音", emotion: "情绪", cameraAngle: "摄像机角度", cameraGear: "摄像机装备", focalLength: "镜头焦段", sceneCloseup: "场景特写"};
            const before = await page.evaluate(id => window.d08.db.shots.get(id), ids.a.shot);
            for (const [field, label] of Object.entries(fields)) {
                await shotField(label).fill(`all-${field}`); assert.equal(await shotField(label).inputValue(), `all-${field}`);
            }
            await release("patchShot"); await flush(ids.a.project);
            const after = await page.evaluate(id => window.d08.db.shots.get(id), ids.a.shot);
            for (const field of Object.keys(fields)) assert.equal(after[field], `all-${field}`);
            for (const field of ["durationSec", "status", "characterIds", "sceneId", "beatId", "firstFrame", "lastFrame", "clip"]) assert.deepEqual(after[field], before[field]);
        });
        await test("shot-page beat title uses the shared draft and preserves independent story text", async () => {
            await navigate(shotPath("a")); const title = beatField(); await title.waitFor();
            await hold("patchStoryBeat"); await title.fill("shot page beat title");
            await page.evaluate(({episode, beat}) => window.d08.db.episodes.get(episode).then(row => window.d08.db.episodes.update(episode, {story: {...row.story, beats: row.story.beats.map(row => row.id === beat ? {...row, timeOfDay: "独立时段"} : row)}})), ids.a);
            assert.equal(await title.inputValue(), "shot page beat title"); await release("patchStoryBeat"); await flush(ids.a.project);
            const beat = await page.evaluate(({episode, beat}) => window.d08.db.episodes.get(episode).then(row => row.story.beats.find(row => row.id === beat)), ids.a);
            assert.equal(beat.title, "shot page beat title"); assert.equal(beat.timeOfDay, "独立时段");
        });
    }
    assert.deepEqual(report.errors, []); assert.equal(report.externalRequests, 0); report.status = "PASS";
} catch (error) {
    report.status = "FAIL"; report.failure = {message: error.message, stack: error.stack}; process.exitCode = 1;
} finally {
    await browser?.close(); await server.close();
    const output = JSON.stringify(report, null, 2); console.log(output);
    const reportPath = process.env.D08_REPORT_PATH ?? process.env.REPORT_PATH;
    if (reportPath) await writeFile(reportPath, output + "\n");
}
