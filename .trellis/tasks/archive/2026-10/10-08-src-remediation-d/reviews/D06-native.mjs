import assert from "node:assert/strict";
import {writeFile, mkdtemp} from "node:fs/promises";
import {readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const {chromium} = await import(process.env.C01_PLAYWRIGHT_PATH ?? "playwright");
const transport = {name: "d06-local-storage-gates", enforce: "pre", transform(source, id) {
    if (process.env.D06_BASELINE_UI === "1" && ["/src/components/agent/GenerationReview.tsx", "/src/components/workspace/ProjectSettingsPanel.tsx"].some(suffix => id.endsWith(suffix))) {
        const relative = id.slice(id.lastIndexOf("/src/") + 1);
        source = readFileSync(resolve(".trellis/tasks/10-08-src-remediation-d/tools/d06/before", relative), "utf8");
    }
    for (const [suffix, name] of [["/src/db/projects.ts", "patchProjectDetails"], ["/src/lib/agent/generationReview.ts", "reviewAndApproveGeneration"], ["/src/db/generationPreferences.ts", "saveGenerationPreference"]]) {
        if (id.endsWith(suffix)) {
            source = source.replace(`export async function ${name}(`, `async function _d06_${name}(`);
            source += `\nexport async function ${name}(...args: Parameters<typeof _d06_${name}>) {
                if (typeof window !== "undefined" && window.d06) await window.d06.wait("${name}");
                return _d06_${name}(...args);
            }\n`;
        }
    }
    return source;
}};
const server = await createServer({configFile: false, plugins: [transport, react(), tailwindcss()], resolve: {alias: {"@": resolve("src")}}, server: {host: "127.0.0.1", port: 0}});
let browser;
const results = [];
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.C01_CHROMIUM_PATH ? {executablePath: process.env.C01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const errors = []; let externalRequests = 0;
    page.on("pageerror", error => {errors.push(error.message); console.error("browser error", error.message);});
    await page.route("**/*", route => {if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();} return route.continue();});
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/d06/");
    try {await page.waitForFunction(() => Boolean(window.d06));}
    catch (error) {const dir = await mkdtemp(join(tmpdir(), "d06-native-setup-")); await writeFile(join(dir, "failure.html"), await page.content()); console.error("SETUP failure", {errors, dir}); throw error;}
    await page.getByLabel("画面描述", {exact: true}).waitFor();
    const antList = async label => {
        const field = page.getByLabel(label, {exact: true});
        const id = await field.getAttribute("id");
        await page.locator(".ant-select-dropdown:visible").waitFor({state: "hidden"});
        await field.click();
        const list = page.locator(`[id="${id}_list"]`);
        await list.waitFor({state: "visible"});
        return list;
    };
    const antChoose = async (label, text) => {
        const list = await antList(label);
        await list.getByRole("option", {name: text, exact: true}).click();
        await list.waitFor({state: "hidden"});
    };
    const antOptions = async label => {
        const list = await antList(label);
        const values = await list.locator(".ant-select-item-option-content").allTextContents();
        await page.keyboard.press("Escape"); await list.waitFor({state: "hidden"}); return values;
    };
    const settingChoose = async (label, text) => {await page.getByRole("combobox", {name: label, exact: true}).click(); await page.getByRole("option", {name: text, exact: true}).click();};
    const show = async view => {await page.evaluate(view => window.d06.view(view), view);};
    const record = () => page.evaluate(() => window.d06.records());
    const test = async (name, body) => {
        try {await body(); assert.deepEqual(errors, []); assert.equal(externalRequests, 0); results.push(name); console.log("PASS", name);}
        catch (error) {
            const dir = await mkdtemp(join(tmpdir(), "d06-native-failure-"));
            await page.screenshot({path: join(dir, "failure.png"), fullPage: true}); await writeFile(join(dir, "failure.html"), await page.content());
            console.error("FAIL", name, "artifacts", dir); console.error("alerts", await page.getByRole("alert").allTextContents()); throw error;
        }
    };
    await test("actual single form model/connector options preserve identity and proposal", async () => {
        assert.equal(await page.getByLabel("画面描述", {exact: true}).inputValue(), "AI original prompt");
        assert.deepEqual(await antOptions("图片尺寸"), ["auto", "1024x1024", "1536x1024", "1024x1536"]);
        await page.getByLabel("画面描述", {exact: true}).fill("  user draft  ");
        await antChoose("供应商连接", "APIMart · Mart account");
        await antChoose("生成模型", "GPT Image 2.5 Ext");
        assert.deepEqual(await antOptions("图片比例"), ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9", "auto"]);
        assert.deepEqual(await antOptions("版本"), ["flare", "sunburst"]);
        assert.equal(await page.getByLabel("画质", {exact: true}).count(), 0);
        assert.equal(await page.getByLabel("画面描述", {exact: true}).inputValue(), "  user draft  ");
        const rows = await record(); assert.equal(rows.call.arguments, await page.evaluate(() => window.d06.original)); assert.equal(rows.jobs.length, 0);
        await page.evaluate(async () => {const {db} = await import("/src/db/database.ts"); await db.connectors.update("mart", {apiKey: ""});});
        await page.getByRole("alert").filter({hasText: "请选择已配置密钥"}).waitFor();
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), true);
        const options = await antOptions("供应商连接"); assert.ok(options.includes("APIMart · Mart account（未配置密钥）"));
        await page.evaluate(async () => {const {db} = await import("/src/db/database.ts"); await db.connectors.delete("mart");});
        await page.getByTitle("原连接已不可用", {exact: true}).waitFor();
        assert.deepEqual(await antOptions("图片比例"), ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21"]);
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), true);
        await page.evaluate(async () => {const {db} = await import("/src/db/database.ts"); await db.connectors.put({id: "mart", definitionId: "apimart", label: "Mart account", baseUrl: "https://no-provider.invalid/v1", apiKey: "fixture-only", updatedAt: "fixture"});});
    });
    await test("hidden incompatible parameters remain rejected until explicit model reselection", async () => {
        await page.evaluate(() => window.d06.proposal({...window.d06.image, connectorId: "mart", model: "gpt-image-2.5-ext", parameters: {quality: "auto", size: "2:1"}}));
        await page.getByRole("alert").filter({hasText: "比例、分辨率或参考图数量无效"}).waitFor();
        assert.equal(await page.getByLabel("画质", {exact: true}).count(), 0);
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), true);
        await antChoose("生成模型", "GPT Image 2");
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), false);
    });
    await test("Veo invalid proposal is retained; explicit resolution transition alone sets eight seconds", async () => {
        await page.evaluate(() => window.d06.proposal({...window.d06.video, parameters: {mode: "text", resolution: "1080p", duration: 4}}));
        await page.getByRole("alert").filter({hasText: "Veo 高分辨率"}).waitFor();
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), true);
        assert.ok(await page.locator(".agent-generation-parameters").innerText().then(text => text.includes("4")));
        await antChoose("分辨率", "720p"); assert.deepEqual(await antOptions("时长（秒）"), ["4", "6", "8"]);
        await antChoose("分辨率", "1080p"); assert.deepEqual(await antOptions("时长（秒）"), ["8"]);
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), false);
        await page.evaluate(() => window.d06.proposal({...window.d06.video, parameters: {mode: "reference", resolution: "1080p", duration: 4}, inputs: [{mediaId: "video-fixture", role: "reference-video"}]}));
        await page.getByRole("alert").filter({hasText: "Veo 高分辨率"}).waitFor();
        assert.deepEqual(await antOptions("分辨率"), ["720p"]); assert.deepEqual(await antOptions("时长（秒）"), ["8"]);
    });
    await test("H3 fixed frame ratio and missing mode are never repaired by hidden controls", async () => {
        await page.evaluate(() => window.d06.proposal({...window.d06.video, connectorId: "mart", model: "MiniMax-H3", parameters: {mode: "frames", aspectRatio: "16:9"}, inputs: [{mediaId: "frame-fixture", role: "first-frame"}]}));
        await page.getByRole("alert").filter({hasText: "首尾帧比例跟随输入图片"}).waitFor();
        assert.equal(await page.getByLabel("视频比例", {exact: true}).count(), 0);
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), true);
        await page.evaluate(() => window.d06.proposal({...window.d06.video, connectorId: "mart", model: "MiniMax-H3", parameters: {}, inputs: [{mediaId: "frame-fixture", role: "first-frame"}]}));
        await page.getByRole("alert").filter({hasText: "输入素材用途不匹配"}).waitFor();
        await antChoose("供应商连接", "AIHubMix · Hub account");
        await antChoose("供应商连接", "APIMart · Mart account");
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), false);
    });
    await test("actual batch uses shared transitions and isolates candidate edits; save does not submit", async () => {
        const before = (await record()).batch.items;
        await show("batch"); await page.getByRole("button", {name: "打开批量生成：D06 batch", exact: true}).click();
        await page.locator(".agent-batch-config-toggle").first().click();
        await antChoose("分辨率", "1080p"); assert.deepEqual(await antOptions("时长（秒）"), ["8"]);
        await page.getByLabel("画面描述", {exact: true}).fill("First edited candidate");
        await page.getByRole("button", {name: "保存草稿", exact: true}).click();
        await page.getByRole("button", {name: "草稿已保存", exact: true}).waitFor();
        const rows = await record();
        assert.equal(rows.batch.items[0].draft.prompt, "First edited candidate");
        assert.deepEqual(rows.batch.items[0].draft.parameters, {mode: "text", resolution: "1080p", duration: 8, aspectRatio: "16:9"});
        assert.deepEqual(rows.batch.items[0].draft.target, before[0].draft.target); assert.deepEqual(rows.batch.items[0].draft.inputs, before[0].draft.inputs);
        assert.deepEqual(rows.batch.items[1].draft, before[1].draft); assert.equal(rows.jobs.length, 0);
        await page.getByRole("button", {name: "关闭批量生成", exact: true}).click();
    });
    await test("project import retained, explicit profile/mode correction and strict Save/reopen", async () => {
        await page.evaluate(async () => {
            const {db} = await import("/src/db/database.ts");
            await db.projects.update(window.d06.ids.project, {generationDefaults: {image: {...window.d06.projectDefaults.image, model: "future", profileVersion: "old", extra: {keep: true}}, video: {...window.d06.projectDefaults.video, mode: "frames", aspectRatio: "16:9"}}});
        });
        await show("settings"); await page.getByRole("combobox", {name: "图片模型", exact: true}).waitFor();
        await page.getByRole("alert").filter({hasText: "图片配置版本或模型尚不支持"}).waitFor();
        assert.equal(await page.getByRole("button", {name: "保存输出配置", exact: true}).isDisabled(), true);
        await settingChoose("图片模型", "APIMart · GPT Image 2.5 Ext");
        await settingChoose("视频比例", "跟随输入图片");
        await settingChoose("视频生成方式", "文字生视频");
        await page.getByRole("alert").filter({hasText: "请选择当前视频方式支持的比例"}).waitFor();
        assert.equal(await page.getByRole("button", {name: "保存输出配置", exact: true}).isDisabled(), true);
        await settingChoose("视频比例", "9:16"); await settingChoose("图片清晰度", "4k");
        await page.getByRole("button", {name: "保存输出配置", exact: true}).click();
        await page.getByRole("status").filter({hasText: "输出配置已保存"}).waitFor();
        const rows = await record(); assert.equal(rows.project.generationDefaults.image.resolution, "4k"); assert.equal(rows.project.generationDefaults.image.version, "flare"); assert.equal(rows.project.generationDefaults.video.resolution, "2K"); assert.equal(rows.project.generationDefaults.video.aspectRatio, "9:16"); assert.equal(rows.jobs.length, 0);
        await show("single"); await show("settings"); await page.getByRole("combobox", {name: "图片清晰度", exact: true}).waitFor();
        assert.ok((await page.getByRole("combobox", {name: "图片清晰度", exact: true}).innerText()).includes("4k"));
    });
    await test("defaults Save busy/failure/retry retains dirty choices and performs zero generation", async () => {
        const before = (await record()).shot;
        await settingChoose("视频比例", "1:1");
        await page.evaluate(() => {window.d06.hold("patchProjectDetails"); window.d06.failures.add("patchProjectDetails");});
        await page.getByRole("button", {name: "保存输出配置", exact: true}).click();
        await page.getByRole("status").filter({hasText: "正在保存"}).waitFor();
        assert.equal(await page.getByRole("button", {name: "保存输出配置", exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole("combobox", {name: "视频比例", exact: true}).isDisabled(), true);
        await page.evaluate(() => window.d06.release("patchProjectDetails"));
        await page.getByRole("alert").filter({hasText: "storage failure"}).waitFor();
        assert.ok((await page.getByRole("combobox", {name: "视频比例", exact: true}).innerText()).includes("1:1"));
        await page.evaluate(() => window.d06.failures.delete("patchProjectDetails"));
        await page.getByRole("button", {name: "保存输出配置", exact: true}).click();
        await page.getByRole("status").filter({hasText: "输出配置已保存"}).waitFor();
        assert.equal((await record()).project.generationDefaults.video.aspectRatio, "1:1"); assert.deepEqual((await record()).shot, before);
    });
    await test("latest project edit conflicts with dirty defaults; adopt-latest remains explicit", async () => {
        await settingChoose("视频比例", "9:16");
        await page.evaluate(async () => {const {db} = await import("/src/db/database.ts"); const project = await db.projects.get(window.d06.ids.project); await db.projects.update(project.id, {generationDefaults: {...project.generationDefaults, video: {...project.generationDefaults.video, aspectRatio: "4:3"}}});});
        assert.ok((await page.getByRole("combobox", {name: "视频比例", exact: true}).innerText()).includes("9:16"));
        await page.getByRole("button", {name: "保存输出配置", exact: true}).click();
        await page.getByRole("alert").filter({hasText: "其他页面已修改"}).waitFor();
        assert.equal((await record()).project.generationDefaults.video.aspectRatio, "4:3");
        await page.getByRole("button", {name: "采用最新内容", exact: true}).click();
        assert.ok((await page.getByRole("combobox", {name: "视频比例", exact: true}).innerText()).includes("4:3"));
        assert.equal((await record()).jobs.length, 0);
    });
    await test("applying and clearing global defaults preserve target/input context with zero approval or submit", async () => {
        await page.evaluate(async () => {
            const {db} = await import("/src/db/database.ts");
            const {saveGenerationPreference} = await import("/src/db/generationPreferences.ts");
            await db.projects.update(window.d06.ids.project, {generationDefaults: undefined});
            await saveGenerationPreference("image", {connectorId: "mart", model: "gpt-image-2.5-ext", parameters: {size: "9:16", version: "sunburst", resolution: "4k"}});
            window.d06.proposal({...window.d06.image, prompt: "Default apply preserves prompt"}); window.d06.view("single");
        });
        await page.getByRole("button", {name: "应用默认", exact: true}).click();
        assert.equal(await page.getByLabel("画面描述", {exact: true}).inputValue(), "Default apply preserves prompt");
        assert.ok(await page.locator(".agent-generation-parameters").innerText().then(text => text.includes("9:16") && text.includes("4k") && text.includes("sunburst")));
        assert.equal(await page.evaluate(() => window.d06.actions.length), 0);
        assert.equal((await record()).call.generationOverride, undefined); assert.equal((await record()).jobs.length, 0);
        await page.getByRole("button", {name: "清除已保存的默认", exact: true}).click();
        await page.getByText("已清除默认图片配置", {exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.d06.actions.length), 0);
        assert.equal((await record()).jobs.length, 0);
    });
    await test("real approval is synchronous-busy, immutable, and default storage failure does not reapprove", async () => {
        await page.evaluate(async () => {const {db} = await import("/src/db/database.ts"); await db.projects.update(window.d06.ids.project, {generationDefaults: undefined}); window.d06.realCall(); window.d06.view("single");});
        await page.getByLabel("画面描述", {exact: true}).waitFor();
        await page.getByLabel("画面描述", {exact: true}).fill("Confirmed prompt");
        await antChoose("图片尺寸", "1536x1024");
        await page.getByText("设为默认图片生成配置", {exact: true}).click();
        await page.evaluate(() => {window.d06.hold("reviewAndApproveGeneration"); window.d06.failures.add("saveGenerationPreference");});
        await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).click();
        assert.equal(await page.getByLabel("画面描述", {exact: true}).isDisabled(), true);
        assert.equal(await page.getByLabel("生成模型", {exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole("button", {name: /^确认并生成(图片|视频)$/, exact: true}).isDisabled(), true);
        await page.evaluate(() => window.d06.proposal({...window.d06.video, prompt: "New call session", parameters: {mode: "text", resolution: "720p", duration: 6}}));
        await page.getByLabel("画面描述", {exact: true}).fill("New call edited draft");
        await page.evaluate(() => window.d06.release("reviewAndApproveGeneration"));
        await page.getByText("本次生成已确认，但默认配置保存失败，请稍后重试。", {exact: true}).waitFor();
        await page.waitForFunction(() => window.d06.actions.length === 1);
        const rows = await record(); assert.equal(rows.call.status, "approved"); assert.equal(rows.call.arguments, await page.evaluate(() => window.d06.original));
        const confirmed = JSON.parse(rows.call.generationOverride.arguments); assert.equal(confirmed.prompt, "Confirmed prompt"); assert.equal(confirmed.parameters.size, "1536x1024");
        const original = JSON.parse(rows.call.arguments); assert.deepEqual(confirmed.target, original.target); assert.deepEqual(confirmed.inputs, original.inputs);
        assert.equal(await page.evaluate(() => window.d06.calls.filter(key => key === "reviewAndApproveGeneration").length), 1); assert.equal(rows.jobs.length, 0);
        assert.equal(await page.getByLabel("画面描述", {exact: true}).inputValue(), "New call edited draft");
        assert.equal(await page.getByLabel("画面描述", {exact: true}).isDisabled(), false);
    });
    const report = {status: "PASS", baselineUI: process.env.D06_BASELINE_UI === "1", paidSubmitRequests: 0, browser: await browser.version(), checks: results, externalRequests, pageErrors: errors, counts: await page.evaluate(() => ({chatFixtureCalls: window.d06.chatFixtureCalls, actions: window.d06.actions.length, storageCalls: window.d06.calls})), limitations: "Actual Ant Design/Radix forms and IndexedDB with local gates; no paid transport or entitlement verification. onAction records resume without running it. Synthetic illegal proposal fixtures exercise actual schema/profile render validation; valid approval fixture uses actual executeChatRun preparation."};
    await writeFile(process.env.D06_NATIVE_REPORT_PATH ?? (process.env.D06_BASELINE_UI === "1" ? ".trellis/tasks/10-08-src-remediation-d/reviews/D06-native-original.json" : ".trellis/tasks/10-08-src-remediation-d/reviews/D06-native.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report));
} finally {await browser?.close(); await server.close();}
