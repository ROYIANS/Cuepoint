import assert from "node:assert/strict";
import {prepareNativeFixture} from "./native-fixture-ready.mjs";
import {writeFile, mkdtemp, rm, mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const {chromium} = await import(process.env.E01_PLAYWRIGHT_PATH ?? "playwright");
const transport = {
    name: "e01-controlled-persistence", enforce: "pre",
    transform(source, id) {
        const functions = {
            "/src/db/agentTaskRecords.ts": ["saveTaskRecord"],
            "/src/db/agentTaskWrapups.ts": ["saveWrapup"],
            "/src/components/audio/AudioSources.tsx": ["keepAudioSource"],
        };
        for (const [suffix, names] of Object.entries(functions)) {
            if (!id.endsWith(suffix)) continue;
            for (const name of names) {
                source = source.replace(`export async function ${name}(`, `async function _e01_${name}(`);
                source += `\nexport async function ${name}(...args: Parameters<typeof _e01_${name}>) {
                    const fixture = (window as any).e01;
                    if (fixture) {fixture.calls.push({key: "${name}", args}); await fixture.wait("${name}");
                        if (fixture.failures.has("${name}")) throw new Error("fixture ${name} failure; retry available");}
                    return _e01_${name}(...args);
                }\n`;
            }
        }
        if (id.endsWith("/src/db/audio.ts")) {
            source = source.replace("export const patchAudioSpeaker =", "const _e01_patchAudioSpeaker =");
            source += `\nexport async function patchAudioSpeaker(...args: Parameters<typeof _e01_patchAudioSpeaker>) {
                const fixture = (window as any).e01;
                if (fixture) {fixture.calls.push({key: "patchAudioSpeaker", args}); await fixture.wait("patchAudioSpeaker");
                    if (fixture.failures.has("patchAudioSpeaker")) throw new Error("fixture patchAudioSpeaker failure; retry available");}
                return _e01_patchAudioSpeaker(...args);
            }\n`;
        }
        return source;
    },
};
const cacheDirectory = await mkdtemp(join(tmpdir(), "e01-drafts-vite-cache-"));
const server = await createServer({cacheDir: cacheDirectory,
    optimizeDeps: {holdUntilCrawlEnd: false, entries: [fileURLToPath(new URL("../tests/fixtures/e01-drafts/index.html", import.meta.url))]},
    configFile: false, plugins: [transport, react(), tailwindcss()],
    resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 5197, strictPort: true, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**", "**/tests/fixtures/e01-writes/**"]}}});
const observations = [];
let browser;
try {
    await server.listen();
    await prepareNativeFixture(server, "/tests/fixtures/e01-drafts/harness.tsx");
    browser = await chromium.launch({headless: true, ...(process.env.E01_CHROMIUM_PATH ? {executablePath: process.env.E01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    page.setDefaultTimeout(10000);
    const errors = [], documents = [];
    page.on("pageerror", error => {errors.push(error.message); console.error("browser error", error.message);});
    page.on("request", request => {if (request.resourceType() === "document" && request.frame() === page.mainFrame()) documents.push(request.url());});
    const url = server.resolvedUrls.local[0] + "tests/fixtures/e01-drafts/";
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.e01));
    const ids = await page.evaluate(() => ({task: window.e01.task.id, taskB: window.e01.taskB.id, thread: window.e01.task.threadId,
        threadB: window.e01.taskB.threadId, project: window.e01.project.id, other: window.e01.other.id}));
    const navigate = async path => {await page.evaluate(path => window.e01.navigate(path), path);};
    const location = () => page.evaluate(() => window.e01.location());
    const alert = page.getByRole("alertdialog", {name: /保留未保存的修改|正在处理修改/});
    const continueEditing = async () => {await alert.getByRole("button", {name: "继续编辑"}).click(); await alert.waitFor({state: "hidden"});};
    const discard = async () => {await alert.getByRole("button", {name: "放弃并离开"}).click(); await alert.waitFor({state: "hidden"});};
    const test = async (name, run) => {
        try {
            await run();
            assert.deepEqual(errors, []);
            assert.deepEqual(documents, [url], "fixture must retain its only explicit main document");
            observations.push({name, outcome: "pass"}); console.log(`PASS ${name}`);
        } catch (failure) {
            const directory = await mkdtemp(join(tmpdir(), "e01-drafts-browser-failure-"));
            await page.screenshot({path: join(directory, "failure.png"), fullPage: true});
            await writeFile(join(directory, "failure.html"), await page.content());
            await writeFile(join(directory, "observations.json"), JSON.stringify({observations, errors, documents}, null, 2));
            console.error(`FAIL ${name}; artifacts: ${directory}`);
            console.error(await page.locator("[role=dialog],[role=alertdialog],[role=alert]").allTextContents());
            throw failure;
        }
    };
    const records = () => page.getByRole("dialog", {name: /工作记录/});
    const openRecords = async () => {
        await navigate("/inspector");
        await page.getByRole("button", {name: "工作记录", exact: true}).click();
        await page.getByRole("button", {name: "新记录"}).click();
    };
    const fillRecord = async () => {await records().getByLabel("标题", {exact: true}).fill("Exact record draft"); await records().locator("textarea").fill("Exact body\nline two");};
    await test("record unchanged new/existing forms leave clean; edit then revert is clean", async () => {
        await openRecords();
        await page.keyboard.press("Escape"); await records().waitFor({state: "hidden"});
        assert.equal(await alert.count(), 0);
        await page.locator(".agent-task-record summary").filter({hasText: "Saved record"}).click();
        await page.getByRole("button", {name: "编辑Saved record"}).first().click();
        const title = records().getByLabel("标题", {exact: true});
        await title.fill("temporarily changed"); await title.fill("Saved record");
        await records().getByRole("button", {name: "取消", exact: true}).click();
        await records().waitFor({state: "hidden"}); assert.equal(await alert.count(), 0);
    });
    await test("record source-only edits dirty the actual form and revert cleanly", async () => {
        await page.getByRole("button", {name: "新记录"}).click();
        await records().locator(".agent-task-evidence-picker summary").click();
        const source = records().getByRole("checkbox", {name: /Reference source/});
        await source.check(); await page.keyboard.press("Escape"); await continueEditing();
        assert.equal(await source.isChecked(), true);
        await source.uncheck(); await page.keyboard.press("Escape"); await records().waitFor({state: "hidden"});
        assert.equal(await alert.count(), 0);
    });
    await test("record Escape/close/backdrop continue preserves exact input, caret and scroll", async () => {
        await page.getByRole("button", {name: "新记录"}).click(); await fillRecord();
        const body = records().locator("textarea");
        await body.evaluate(el => {el.focus(); el.setSelectionRange(4, 8); el.scrollTop = 7;});
        await page.keyboard.press("Escape"); await continueEditing();
        assert.equal(await body.inputValue(), "Exact body\nline two");
        assert.deepEqual(await body.evaluate(el => [el.selectionStart, el.selectionEnd]), [4, 8]);
        await records().getByRole("button", {name: "关闭", exact: true}).click(); await continueEditing();
        await page.mouse.click(5, 5); await continueEditing();
        assert.equal(await records().getByLabel("标题", {exact: true}).inputValue(), "Exact record draft");
    });
    await test("record local task replacement/SPA/back cancel retains owner; discard replaces deliberately", async () => {
        await page.evaluate(id => window.e01.selectTask(id), ids.taskB); await continueEditing();
        assert.equal(await records().getByLabel("标题", {exact: true}).inputValue(), "Exact record draft");
        await navigate("/away"); await continueEditing(); assert.equal(await location(), "/inspector");
        await page.goBack(); await continueEditing(); assert.equal(await location(), "/inspector");
        await page.evaluate(id => window.e01.selectTask(id), ids.task);
        await page.waitForFunction(id => window.e01.observedTask() === id, ids.task);
        await page.evaluate(id => window.e01.selectTask(id), ids.taskB); await discard();
        await page.getByRole("heading", {name: "Task B", exact: true}).waitFor();
        assert.equal(await records().count(), 0);
        await navigate("/away");
    });
    await test("record failed save and pending departure/duplicate actions retain frozen input and retry", async () => {
        await openRecords(); await fillRecord();
        await page.evaluate(() => {window.e01.hold("saveTaskRecord"); window.e01.failures.add("saveTaskRecord");});
        await records().locator("form").evaluate(form => {form.requestSubmit(); form.requestSubmit();});
        await page.keyboard.press("Escape");
        await alert.waitFor(); assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0);
        await continueEditing();
        await page.evaluate(id => window.e01.selectTask(id), ids.taskB);
        await alert.waitFor(); assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0); await continueEditing();
        await page.evaluate(id => window.e01.selectTask(id), ids.task);
        await page.waitForFunction(id => window.e01.observedTask() === id, ids.task);
        await navigate("/away"); await alert.waitFor(); await continueEditing();
        await page.evaluate(() => window.e01.release("saveTaskRecord"));
        await records().getByRole("alert").waitFor();
        assert.equal(await records().locator("textarea").inputValue(), "Exact body\nline two");
        assert.equal(await page.evaluate(() => window.e01.calls.filter(row => row.key === "saveTaskRecord").length), 1);
        await page.evaluate(() => window.e01.failures.delete("saveTaskRecord"));
        await records().getByRole("button", {name: "保存记录", exact: true}).click(); await records().waitFor({state: "hidden"});
        const saved = await page.evaluate(id => window.e01.db.agentTaskRecords.where("taskId").equals(id).toArray(), ids.task);
        assert(saved.some(row => row.title === "Exact record draft" && row.body === "Exact body\nline two"));
        await page.getByRole("button", {name: "关闭任务详情"}).click(); assert.equal(await alert.count(), 0);
        await navigate("/away");
    });
    const openWrapup = async () => {
        await navigate("/inspector"); await page.getByRole("button", {name: "验收总结", exact: true}).click();
        await page.getByRole("button", {name: "基于最新记录填写", exact: true}).click();
        await page.locator(".task-review-editor").waitFor();
    };
    const wrapInput = () => page.locator(".task-review-editor > label textarea");
    await test("wrapup opening baseline clean; exact dirty text survives cancel and owner board", async () => {
        await openWrapup(); await page.getByRole("button", {name: "取消编辑"}).click(); assert.equal(await alert.count(), 0);
        await page.getByRole("button", {name: "编辑", exact: true}).click(); await wrapInput().fill("Exact wrapup\nsecond line");
        await page.getByRole("button", {name: "取消编辑"}).click(); await continueEditing();
        const scroll = page.locator(".agent-task-inspector-scroll");
        await scroll.evaluate(el => {el.scrollTop = 120;});
        const position = await scroll.evaluate(el => el.scrollTop);
        await page.getByRole("button", {name: "关闭任务详情"}).click(); await continueEditing();
        assert.equal(await scroll.evaluate(el => el.scrollTop), position);
        await page.getByRole("button", {name: "任务工作台", exact: true}).click(); await continueEditing();
        assert.equal(await wrapInput().inputValue(), "Exact wrapup\nsecond line"); assert.equal(await location(), "/inspector");
    });
    await test("wrapup pending Escape/route, failure retry, sources and deliberate discard", async () => {
        await page.getByRole("button", {name: "添加决策与约束"}).click();
        await page.getByLabel("决策与约束 1", {exact: true}).fill("Retained decision");
        await page.evaluate(() => {window.e01.hold("saveWrapup"); window.e01.failures.add("saveWrapup");});
        await page.getByRole("button", {name: "保存草稿", exact: true}).click();
        await page.keyboard.press("Escape"); await alert.waitFor(); assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0); await continueEditing();
        await navigate("/away"); await continueEditing();
        await page.evaluate(() => window.e01.release("saveWrapup")); await page.locator(".task-review-error").waitFor();
        assert.equal(await wrapInput().inputValue(), "Exact wrapup\nsecond line");
        assert.equal(await page.getByLabel("决策与约束 1", {exact: true}).inputValue(), "Retained decision");
        await page.evaluate(() => window.e01.failures.delete("saveWrapup"));
        await page.getByRole("button", {name: "保存草稿", exact: true}).click(); await page.locator(".task-review-editor").waitFor({state: "hidden"});
        await page.getByRole("button", {name: "编辑", exact: true}).click(); await wrapInput().fill("Discarded version");
        await navigate("/away"); await discard(); assert.equal(await location(), "/away");
    });
    const voices = () => page.getByRole("dialog", {name: /音色/});
    const openVoice = async () => {await navigate("/voice"); await voices().getByRole("button", {name: "编辑", exact: true}).click();};
    await test("voice unchanged baseline clean; name/mode/instruction/sample revert and dismissal", async () => {
        await openVoice(); await voices().getByRole("button", {name: "返回音色列表"}).click(); assert.equal(await alert.count(), 0);
        await voices().getByRole("button", {name: "编辑", exact: true}).click();
        await voices().getByLabel("音色名称").fill("temporary"); await voices().getByLabel("音色名称").fill("Saved voice");
        await voices().getByRole("tab", {name: "描述声音"}).click();
        await voices().getByLabel("描述声音").fill("Exact voice instruction");
        await page.keyboard.press("Escape"); await continueEditing();
        assert.equal(await voices().getByLabel("描述声音").inputValue(), "Exact voice instruction");
        await voices().getByLabel("描述声音").fill(""); await voices().getByRole("tab", {name: "预置音色"}).click();
        await page.keyboard.press("Escape"); await voices().waitFor({state: "hidden"}); assert.equal(await alert.count(), 0);
        await page.getByRole("button", {name: "Open voices"}).click(); await voices().getByRole("button", {name: "编辑", exact: true}).click();
        await voices().getByLabel("音色名称").fill("Exact voice draft");
        await voices().getByText("试音文本", {exact: true}).click();
        await voices().getByLabel("试音文本").fill("Exact sample text");
        await page.keyboard.press("Escape"); await continueEditing();
        await voices().getByRole("button", {name: "关闭", exact: true}).click(); await continueEditing();
        await page.mouse.click(5, 5); await continueEditing();
        await voices().getByRole("button", {name: "返回音色列表"}).click(); await continueEditing();
        assert.equal(await voices().getByLabel("音色名称").inputValue(), "Exact voice draft");
        assert.equal(await voices().getByLabel("试音文本").inputValue(), "Exact sample text");
    });
    await test("voice project switch/external close/SPA/back/forward cancellation freezes owner", async () => {
        await page.evaluate(id => window.e01.selectProject(id), ids.other); await continueEditing();
        await page.evaluate(() => window.e01.toggleVoice(false)); await continueEditing();
        await navigate("/away"); await continueEditing();
        await page.goBack(); await continueEditing(); assert.equal(await location(), "/voice");
        assert.equal(await voices().getByLabel("音色名称").inputValue(), "Exact voice draft");
        await page.evaluate(() => {window.e01.selectProject(window.e01.project.id); window.e01.toggleVoice(true);});
    });
    await test("voice pending/failed save preserves text; retry writes captured revision/project", async () => {
        await page.evaluate(() => {window.e01.hold("patchAudioSpeaker"); window.e01.failures.add("patchAudioSpeaker");});
        await voices().getByRole("button", {name: "保存音色"}).evaluate(button => {button.click(); button.click();});
        assert.equal(await page.evaluate(() => window.e01.calls.filter(row => row.key === "patchAudioSpeaker").length), 1);
        await page.keyboard.press("Escape"); await voices().waitFor();
        await navigate("/away"); await alert.waitFor(); assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0); await continueEditing();
        await page.evaluate(() => window.e01.release("patchAudioSpeaker")); await voices().getByRole("alert").waitFor();
        assert.equal(await voices().getByLabel("音色名称").inputValue(), "Exact voice draft");
        assert.equal(await voices().getByLabel("试音文本").inputValue(), "Exact sample text");
        await page.evaluate(() => window.e01.failures.delete("patchAudioSpeaker"));
        await voices().getByRole("button", {name: "保存音色"}).click(); await voices().getByText("Exact voice draft", {exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.e01.calls.filter(row => row.key === "patchAudioSpeaker").every(row => row.args[0] === window.e01.project.id && row.args[2] === 1)), true);
        await page.keyboard.press("Escape"); await voices().waitFor({state: "hidden"}); assert.equal(await alert.count(), 0);
        await navigate("/away");
    });
    await test("native forward blocked then discard; discarded voice never saved", async () => {
        await page.goBack(); await voices().waitFor();
        await voices().getByRole("button", {name: "编辑", exact: true}).click(); await voices().getByLabel("音色名称").fill("Never saved");
        await page.goForward(); await continueEditing(); assert.equal(await location(), "/voice");
        await page.goForward(); await discard(); assert.equal(await location(), "/away");
        assert.equal(await page.evaluate(() => window.e01.db.audioSpeakers.filter(row => row.name === "Never saved").count()), 0);
    });
    await test("voice reference import pending/failed retry uses owned bytes and dirty reference retention", async () => {
        await navigate("/voice"); await voices().getByRole("button", {name: "编辑", exact: true}).click();
        await voices().getByRole("tab", {name: "克隆声音"}).click();
        const bytes = await page.evaluate(() => window.e01.referenceBytes);
        await page.evaluate(() => {window.e01.hold("keepAudioSource"); window.e01.failures.add("keepAudioSource");});
        await voices().locator("input[type=file]").setInputFiles({name: "reference.wav", mimeType: "audio/wav", buffer: Buffer.from(bytes)});
        await voices().getByRole("button", {name: "正在保存参考…"}).waitFor();
        await page.keyboard.press("Escape"); await voices().waitFor();
        await navigate("/away"); await alert.waitFor(); assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0); await continueEditing();
        await page.evaluate(() => window.e01.release("keepAudioSource")); await voices().getByRole("alert").waitFor();
        await page.evaluate(() => window.e01.failures.delete("keepAudioSource"));
        await voices().locator("input[type=file]").setInputFiles({name: "reference.wav", mimeType: "audio/wav", buffer: Buffer.from(bytes)});
        await voices().getByRole("combobox", {name: "选择参考声音"}).filter({hasText: "reference.wav"}).waitFor();
        await page.keyboard.press("Escape"); await continueEditing();
        assert.equal(await voices().getByRole("combobox", {name: "选择参考声音"}).textContent(), "reference.wav");
        await page.keyboard.press("Escape"); await discard();
        assert.equal(await page.evaluate(() => window.e01.db.audioTakes.filter(row => row.name === "reference.wav" && row.projectId === window.e01.project.id).count()), 1);
        await navigate("/away");
    });
    await test("voice actual durable audition pending/failed retry and preview media survive discard", async () => {
        await page.evaluate(async () => window.e01.db.connectors.add({id: "e01-mimo", definitionId: "mimo", name: "Offline fixture", baseUrl: "https://mimo.fixture.test/v1", apiKey: "offline-fixture-only", updatedAt: "2026-10-09"}));
        await openVoice(); await voices().getByText("试音文本", {exact: true}).click(); await voices().getByLabel("试音文本").fill("Preview owned text");
        await page.evaluate(() => {window.e01.hold("audition"); window.e01.failures.add("audition");});
        await voices().getByRole("button", {name: "生成试音"}).click();
        await voices().getByRole("button", {name: "处理中…"}).waitFor();
        await navigate("/away"); await alert.waitFor(); assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0); await continueEditing();
        await page.evaluate(() => window.e01.release("audition")); await voices().getByRole("alert").waitFor();
        assert.equal(await voices().getByLabel("试音文本").inputValue(), "Preview owned text");
        await page.evaluate(() => window.e01.failures.delete("audition"));
        await voices().getByRole("button", {name: "生成试音"}).click(); await voices().getByRole("button", {name: "播放 音色试音"}).waitFor();
        const media = await page.evaluate(async () => (await window.e01.db.audioTakes.toArray()).filter(row => row.source === "tts").map(row => row.mediaId));
        assert.equal(media.length, 1);
        await page.keyboard.press("Escape"); await discard();
        assert.equal(await page.evaluate(async ids => (await window.e01.db.media.bulkGet(ids)).every(Boolean), media), true);
        await navigate("/away");
    });
    await test("actual AgentChatPage thread selection and task board route retain record draft", async () => {
        await navigate(`/agent/${ids.thread}`);
        await page.locator(".agent-task-summary-label").click();
        await page.getByRole("button", {name: "工作记录", exact: true}).click(); await page.getByRole("button", {name: "新记录"}).click(); await fillRecord();
        await page.locator(".agent-topic-row").filter({hasText: "Task B"}).locator(".agent-topic-row-title").evaluate(element => element.click());
        await continueEditing();
        assert.equal(await location(), `/agent/${ids.thread}`);
        assert.equal(await records().getByLabel("标题", {exact: true}).inputValue(), "Exact record draft");
        const threadsBefore = await page.evaluate(() => window.e01.db.chatThreads.count());
        await page.locator(".agent-sidebar-nav").filter({hasText: /^开启新话题$/}).evaluate(element => element.click());
        await continueEditing();
        assert.equal(await page.evaluate(() => window.e01.db.chatThreads.count()), threadsBefore);
        await page.locator(".agent-sidebar-nav").filter({hasText: /^任务$/}).evaluate(element => element.click());
        await continueEditing();
        assert.equal(await location(), `/agent/${ids.thread}`);
        await navigate("/agent/tasks"); await continueEditing();
        await page.keyboard.press("Escape"); await discard();
        await page.getByRole("button", {name: "任务工作台", exact: true}).click();
        await page.getByRole("heading", {name: "让每一个想法，走向完成。"}).waitFor();
    });
    await test("retired pending record completion cannot publish into a newer mounted editor", async () => {
        await navigate("/away"); await openRecords(); await fillRecord();
        await page.evaluate(() => window.e01.hold("saveTaskRecord"));
        await records().getByRole("button", {name: "保存记录", exact: true}).click();
        await page.evaluate(() => window.e01.retire()); await records().waitFor({state: "hidden"});
        await navigate("/voice"); await voices().getByRole("button", {name: "编辑", exact: true}).click(); await voices().getByLabel("音色名称").fill("New owner input");
        await page.evaluate(() => window.e01.release("saveTaskRecord"));
        await page.waitForFunction(async id => (await window.e01.db.agentTaskRecords.where("taskId").equals(id).toArray()).filter(row => row.title === "Exact record draft").length === 2, ids.task);
        assert.equal(await voices().getByLabel("音色名称").inputValue(), "New owner input");
        await page.keyboard.press("Escape"); await discard();
    });
    await test("retired voice save completes only for captured owner and preserves new record input", async () => {
        await navigate("/away"); await openVoice(); await voices().getByLabel("音色名称").fill("Retired voice write");
        await page.evaluate(() => window.e01.hold("patchAudioSpeaker"));
        await voices().getByRole("button", {name: "保存音色"}).click();
        await page.evaluate(() => window.e01.retire()); await voices().waitFor({state: "hidden"});
        await openRecords(); await fillRecord();
        await records().getByLabel("标题", {exact: true}).fill("After retired voice");
        await page.evaluate(() => window.e01.release("patchAudioSpeaker"));
        await page.waitForFunction(async () => (await window.e01.db.audioSpeakers.toArray()).some(row => row.name === "Retired voice write"));
        assert.equal(await records().getByLabel("标题", {exact: true}).inputValue(), "After retired voice");
        await page.keyboard.press("Escape"); await discard(); await navigate("/away");
    });
    await test("retired wrapup save completes without replacing a newer voice editor", async () => {
        await openWrapup(); await wrapInput().fill("Retired wrapup write");
        await page.evaluate(() => window.e01.hold("saveWrapup")); await page.getByRole("button", {name: "保存草稿", exact: true}).click();
        await page.evaluate(() => window.e01.retire()); await page.locator(".task-review-editor").waitFor({state: "hidden"});
        await navigate("/voice"); await voices().getByRole("button", {name: "编辑", exact: true}).click(); await voices().getByLabel("音色名称").fill("After retired wrapup");
        await page.evaluate(() => window.e01.release("saveWrapup"));
        await page.waitForFunction(async () => (await window.e01.db.agentTaskWrapups.toArray()).some(row => row.content.overview === "Retired wrapup write"));
        assert.equal(await voices().getByLabel("音色名称").inputValue(), "After retired wrapup");
        await page.keyboard.press("Escape"); await discard();
    });
    await test("shared guard continues number/range/date/color input focus without unsupported caret APIs", async () => {
        await navigate("/shared-guard"); await page.getByLabel("guard number").fill("42");
        for (const kind of ["number", "range", "date", "color"]) {
            const input = page.getByLabel(`guard ${kind}`);
            await input.focus(); assert.equal(await input.evaluate(el => el.selectionStart), null);
            await navigate("/away"); await continueEditing();
            assert.equal(await location(), "/shared-guard");
            assert.equal(await input.evaluate(el => document.activeElement === el), true);
            assert.equal(await page.getByLabel("guard number").inputValue(), "42");
        }
        await navigate("/away"); await discard(); assert.equal(await location(), "/away");
    });
    await test("actual AgentChatPage current-thread deletion waits for deliberate draft discard", async () => {
        await navigate(`/agent/${ids.thread}`); await page.locator(".agent-task-summary-label").click();
        await page.getByRole("button", {name: "工作记录", exact: true}).click(); await page.getByRole("button", {name: "新记录"}).click(); await fillRecord();
        const requestDelete = async () => {
            await page.locator(".agent-topic-row.is-active .agent-topic-row-actions [role=button]").filter({has: page.locator("svg.lucide-trash-2")}).evaluate(element => element.click());
            await page.getByRole("alertdialog", {name: "删除话题"}).getByRole("button", {name: "删除", exact: true}).click();
        };
        await requestDelete(); await continueEditing();
        assert.equal(await location(), `/agent/${ids.thread}`);
        assert.equal(await page.evaluate(id => window.e01.db.chatThreads.get(id).then(Boolean), ids.thread), true);
        assert.equal(await records().getByLabel("标题", {exact: true}).inputValue(), "Exact record draft");
        await requestDelete(); await discard();
        await page.waitForFunction(id => window.e01.db.chatThreads.get(id).then(row => !row), ids.thread);
        assert.equal(await location(), "/agent");
        assert.equal(await page.evaluate(id => window.e01.db.agentTaskRecords.where("taskId").equals(id).count(), ids.task), 0);
    });
    const output = process.env.E01_OBSERVATIONS;
    if (output) {await mkdir(join(output, ".."), {recursive: true}); await writeFile(output, JSON.stringify({observations, errors, documents}, null, 2) + "\n");}
    console.log(`E01 native drafts: ${observations.length} passed`);
} finally {
    await browser?.close(); await server.close(); await rm(cacheDirectory, {recursive: true, force: true});
}
