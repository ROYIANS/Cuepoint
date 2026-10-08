import assert from "node:assert/strict";
import {writeFile, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Reuse installed desktop tooling; never install project/runtime dependencies.
const playwrightPath = process.env.B01_PLAYWRIGHT_PATH ?? "playwright";
const {chromium} = await import(playwrightPath);
const transport = {
    name: "b01-controlled-transport", enforce: "pre",
    transform(source, id) {
        if (id.endsWith("/src/lib/media.ts")) {
            source = source.replace("    if (!file.type.startsWith(\"image/\")", `    const fixture = (window as any).b01;
    if (fixture) {
        fixture.media.uploads.push(file);
        await fixture.wait("upload");
        if (fixture.media.fail) throw new Error("fixture upload failure");
    }
    if (!file.type.startsWith("image/")`);
            source = source.replace("    return new Promise((resolve) => {", `    const fixture = (window as any).b01;
    if (fixture) {fixture.media.picked++; return Promise.resolve(fixture.media.file);}
    return new Promise((resolve) => {`);
        }
        const commands = {
            "/src/db/shots.ts": "patchShot",
            "/src/db/projects.ts": "patchProjectDetails",
            "/src/db/assets.ts": "setCharacterSlot",
        };
        for (const [suffix, name] of Object.entries(commands)) {
            if (id.endsWith(suffix)) {
                source = source.replace(`export async function ${name}(`, `async function _b01_${name}(`);
                source += `\nexport async function ${name}(...args: Parameters<typeof _b01_${name}>) {
                    const fixture = typeof window === "undefined" ? undefined : (window as any).b01;
                    if (fixture) {
                        await fixture.wait("${name}");
                        if (fixture.failures.has("${name}")) throw new Error("fixture ${name} failure");
                    }
                    return _b01_${name}(...args);
                }\n`;
            }
        }
        return source;
    },
};
const cacheDirectory = await mkdtemp(join(tmpdir(), "b01-vite-cache-"));
const server = await createServer({cacheDir: cacheDirectory, optimizeDeps: {entries: [fileURLToPath(new URL("../tests/fixtures/b01/index.html", import.meta.url))]}, configFile: false, plugins: [transport, react(), tailwindcss()], resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 0}});
let browser;
let passed = 0;
try {
    await server.listen();
    const url = server.resolvedUrls.local[0] + "tests/fixtures/b01/";
    browser = await chromium.launch({headless: true, ...(process.env.B01_CHROMIUM_PATH ? {executablePath: process.env.B01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage();
    const errors = [];
    const documentRequests = [];
    page.on("request", request => {
        if (request.resourceType() === "document" && request.frame() === page.mainFrame()) documentRequests.push(request.url());
    });
    page.on("pageerror", error => {errors.push(error.message); console.error("browser error", error.message);});
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.b01));
    const ids = await page.evaluate(() => window.b01.ids);
    const navigate = async path => {await page.evaluate(path => window.b01.navigate(path), path);};
    const location = () => page.evaluate(() => window.b01.location());
    page.setDefaultTimeout(10000);
    const eventually = async (selector, text) => {
        await page.locator(selector).filter({hasText: text}).first().waitFor();
    };
    const test = async (name, run) => {
        try {
            await run(); assert.equal(errors.length, 0, errors.join("\n"));
            assert.equal(documentRequests.length, 1, `Unexpected full-document navigation: ${documentRequests.join(" -> ")}`);
            passed++; console.log(`PASS ${name}`);
        } catch (error) {
            const directory = await mkdtemp(join(tmpdir(), "b01-browser-failure-"));
            await page.screenshot({path: join(directory, "failure.png"), fullPage: true});
            await writeFile(join(directory, "failure.html"), await page.content());
            console.error(`FAIL ${name}; ${passed} passed; artifacts: ${directory}`);
            console.error("visible dialogs/status", await page.locator("[role=dialog], [role=alertdialog], [role=status], [role=alert]").allTextContents());
            throw error;
        }
    };
    const click = text => page.getByRole("button", {name: text, exact: true}).click();
    const assetPath = (kind, index = 0) => `/asset/${ids.a}/${kind}/${ids.rows[kind][index].id}`;
    const shotPath = episode => `/p/${ids.a}/e/${episode}/shots`;

    await test("project route key and same-project episode envelope keep settings mounted", async () => {
        await navigate(shotPath(ids.ea)); await eventually("span", "Episode A");
        await click("项目设定");
        await page.evaluate(id => window.b01.hold(`episodes:${id}`), ids.eb);
        await navigate(shotPath(ids.eb));
        await page.waitForFunction(id => window.b01.location().includes(id), ids.eb);
        assert.equal(await page.getByText("Episode A", {exact: true}).count(), 0);
        assert.equal(await page.getByRole("dialog", {name: "项目设定"}).count(), 1);
        await page.evaluate(id => window.b01.release(`episodes:${id}`), ids.eb);
        await eventually("span", "Episode B");
        await click("完成");
        await page.evaluate(id => window.b01.hold(`projects:${id}`), ids.b);
        await navigate(`/p/${ids.b}/world`);
        await eventually("div", "加载项目");
        assert.equal(await page.getByText("Project A", {exact: true}).count(), 0);
        await page.evaluate(id => window.b01.release(`projects:${id}`), ids.b);
        await eventually("span", "Project B");
    });

    await test("home waits for matching null episode before repair", async () => {
        await page.evaluate(async id => {await window.b01.db.episodes.where("projectId").equals(id).delete(); window.b01.hold(`episodes:list:${id}`);}, ids.film);
        await navigate(`/p/${ids.film}`);
        await eventually("div", "加载项目");
        assert.equal(await page.evaluate(id => window.b01.db.episodes.where("projectId").equals(id).count(), ids.film), 0);
        await page.evaluate(id => window.b01.release(`episodes:list:${id}`), ids.film);
        await page.waitForFunction(id => window.b01.location().startsWith(`/p/${id}/e/`), ids.film);
    });

    for (const kind of ["character", "scene", "prop", "style"]) {
        await test(`${kind}: router blocks dirty target switch; continue preserves; discard remounts`, async () => {
            await navigate(assetPath(kind));
            await page.getByRole("button", {name: /·/}).first().click();
            await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill(`${kind} draft`);
            await navigate(assetPath(kind, 1));
            await eventually("[role=alertdialog]", "保留未保存");
            assert.equal(await location(), assetPath(kind));
            await click("继续编辑");
            assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), `${kind} draft`);
            await page.evaluate(async ({kind, id}) => {await window.b01.db[kind === "character" ? "characters" : kind === "scene" ? "scenes" : kind === "prop" ? "props" : "styles"].update(id, {name: "background update"});}, {kind, id: ids.rows[kind][0].id});
            assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), `${kind} draft`);
            await navigate(assetPath(kind, 1)); await click("放弃并离开");
            await page.waitForFunction(path => window.b01.location() === path, assetPath(kind, 1));
            await page.getByRole("button", {name: /·/}).first().click();
            assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "");
            await click("取消");
        });
    }

    await test("slot upload pending blocks discard; failed File retry and same-target draft survive", async () => {
        await navigate(assetPath("character"));
        await page.getByRole("button", {name: /·/}).first().click();
        await page.evaluate(() => {window.b01.hold("upload"); window.b01.media.fail = true;});
        await click("上传素材");
        await navigate(assetPath("character", 1));
        await eventually("[role=alertdialog]", "正在处理");
        assert.equal(await page.getByRole("button", {name: "放弃并离开", exact: true}).count(), 0);
        await click("继续编辑");
        await page.evaluate(() => window.b01.release("upload"));
        await click("重试上传").catch(async () => {await page.getByRole("button", {name: "重试上传", exact: true}).waitFor();});
        // First retry still fails; next retry succeeds using the very same File.
        await page.getByRole("button", {name: "重试上传", exact: true}).waitFor();
        await page.evaluate(() => {window.b01.media.fail = false;});
        await click("重试上传"); await page.getByRole("button", {name: "保存", exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.b01.media.uploads.every(file => file === window.b01.media.file)), true);
        assert.equal(await page.evaluate(() => window.b01.media.picked), 1);
        const owned = await page.evaluate(async () => (await window.b01.db.media.toArray()).find(row => row.filename === "upload.png").id);
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill("owned draft");
        await page.evaluate(async id => window.b01.assets.setCharacterSlot(id, "front", {prompt: "theirs", referenceImageIds: [], referenceVideoIds: []}), ids.rows.character[0].id);
        await click("保存"); await eventually("[role=alert]", "内容已保留");
        assert.equal(await page.evaluate(id => window.b01.db.media.get(id).then(Boolean), owned), true);
        await navigate(assetPath("character", 1)); await click("继续编辑");
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "owned draft");
        await navigate(assetPath("character", 1)); await click("放弃并离开");
        await page.waitForFunction(path => window.b01.location() === path, assetPath("character", 1));
        assert.equal(await page.evaluate(id => window.b01.db.media.get(id).then(Boolean), owned), false);
    });

    await test("output settings SPA guard continues and disallows pending discard", async () => {
        await navigate(`/p/${ids.a}/world`); await click("项目设定");
        await page.getByRole("combobox", {name: "项目目标画幅"}).click();
        await page.getByRole("option", {name: /1:1/, exact: false}).click();
        await navigate(`/p/${ids.b}/world`); await click("继续编辑");
        assert.equal(await page.getByRole("combobox", {name: "项目目标画幅"}).textContent().then(text => text.includes("1:1")), true);
        await page.evaluate(() => window.b01.hold("patchProjectDetails"));
        await click("保存输出配置"); await navigate(`/p/${ids.b}/world`);
        await eventually("[role=alertdialog]", "正在处理");
        assert.equal(await page.getByRole("button", {name: "放弃并离开", exact: true}).count(), 0);
        await click("继续编辑"); await page.evaluate(() => window.b01.release("patchProjectDetails"));
        await eventually("[role=status]", "输出配置已保存"); await click("完成");
    });

    await test("material parent selection is guarded; latest C wins and continue allows reselect B", async () => {
        await navigate("/materials"); await eventually("[role=dialog]", "Material A");
        await page.getByRole("textbox").first().fill("material draft");
        await page.evaluate(id => window.b01.selectMaterial(id), ids.mb);
        await eventually("[role=alertdialog]", "保留未保存");
        await click("继续编辑");
        assert.equal(await page.getByRole("textbox").first().inputValue(), "material draft");
        await page.evaluate(id => window.b01.selectMaterial(id), ids.mb);
        await eventually("[role=alertdialog]", "保留未保存");
        await page.evaluate(id => window.b01.selectMaterial(id), ids.mc);
        await click("放弃并离开"); await eventually("[role=dialog]", "Material C");
        assert.equal(await page.getByRole("textbox").first().inputValue(), "Material C");
        await page.getByRole("textbox").first().fill("C draft");
        await navigate("/away"); await click("继续编辑"); assert.equal(await location(), "/materials");
        await navigate("/away"); await click("放弃并离开"); await eventually("p", "left fixture");
    });

    await test("shots and print wait for matching empty lists across two episodes", async () => {
        await navigate(shotPath(ids.ea)); await eventually("h1", "制作分镜");
        await page.evaluate(async ({a, eb}) => {
            await window.b01.db.shots.where("episodeId").equals(eb).delete();
            window.b01.hold(`shots:list:${eb}`);
        }, ids);
        await navigate(shotPath(ids.eb)); await eventually("div", "加载分镜");
        assert.equal(await page.getByRole("heading", {name: "制作分镜"}).count(), 0);
        await page.evaluate(id => window.b01.release(`shots:list:${id}`), ids.eb);
        await eventually("h1", "制作分镜");
        await navigate(`/p/${ids.a}/e/${ids.ea}/produce/storyboard`);
        await eventually("h1", "Project A");
        await page.evaluate(id => window.b01.hold(`shots:list:${id}`), ids.eb);
        await navigate(`/p/${ids.a}/e/${ids.eb}/produce/storyboard`); await eventually("div", "加载故事板");
        assert.equal(await page.getByRole("button", {name: "打印", exact: true}).count(), 0);
        await page.evaluate(id => window.b01.release(`shots:list:${id}`), ids.eb);
        await eventually("p", "还没有镜头");
        await navigate(`/p/${ids.a}/e/missing/produce/storyboard`); await eventually("p", "找不到这一集");
    });

    await test("shot slot locate search keeps draft and dirty navigation blocks episode switch", async () => {
        await navigate(shotPath(ids.ea)); await eventually("h1", "制作分镜");
        await page.getByRole("group", {name: "分镜视图"}).getByRole("button", {name: "素材", exact: true}).click();
        await page.getByRole("button", {name: /镜头 .*· 首帧/}).first().click();
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill("shot draft");
        await navigate(`${shotPath(ids.ea)}?shot=${ids.sa}`);
        await page.waitForFunction(id => window.b01.router.state.location.search.shot === id, ids.sa);
        assert.equal(await page.getByRole("alertdialog").count(), 0);
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "shot draft");
        await navigate(shotPath(ids.eb)); await click("继续编辑");
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "shot draft");
        await navigate(shotPath(ids.eb)); await click("放弃并离开");
        await page.waitForFunction(path => window.b01.location() === path, shotPath(ids.eb));
    });

    await test("relations pending/error router departure requires resolve or discard", async () => {
        await navigate(shotPath(ids.ea)); await eventually("h1", "制作分镜"); await click("道具与风格");
        await page.evaluate(() => {window.b01.hold("patchShot"); window.b01.failures.add("patchShot");});
        await page.getByRole("dialog", {name: "镜头道具与风格", exact: true}).getByRole("combobox", {name: "镜头风格", exact: true}).click();
        await page.getByRole("option", {name: "不使用风格", exact: true}).click();
        await navigate(shotPath(ids.eb)); await eventually("[role=alertdialog]", "正在处理");
        assert.equal(await page.getByRole("button", {name: "放弃并离开", exact: true}).count(), 0);
        await click("继续编辑"); await page.evaluate(() => window.b01.release("patchShot"));
        await eventually("[role=status]", "fixture patchShot failure");
        await navigate(shotPath(ids.eb)); await click("继续编辑");
        assert.equal(await location(), shotPath(ids.ea));
        await navigate(shotPath(ids.eb)); await click("放弃并离开");
        await page.waitForFunction(path => window.b01.location() === path, shotPath(ids.eb));
        await page.evaluate(() => window.b01.failures.delete("patchShot"));
    });

    await test("deleted asset/material keeps active dirty sessions and blocks departure", async () => {
        await navigate(assetPath("prop"));
        await page.getByRole("button", {name: /·/}).first().click();
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill("deleted prop draft");
        await page.evaluate(id => window.b01.db.props.delete(id), ids.rows.prop[0].id);
        await eventually("[role=alert]", "草稿仍保留");
        assert.equal(await page.getByRole("button", {name: "保存", exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "deleted prop draft");
        await navigate("/away"); await click("继续编辑");
        await navigate("/away"); await click("放弃并离开");
        await page.waitForFunction(() => window.b01.location() === "/away");
        await navigate("/materials"); await eventually("[role=dialog]", "Material A");
        await page.getByRole("textbox").first().fill("deleted material draft");
        await page.evaluate(id => window.b01.db.libraryMaterials.delete(id), ids.ma);
        await eventually("[role=alert]", "素材不存在或已删除");
        assert.equal(await page.getByRole("button", {name: "保存修改", exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole("textbox").first().inputValue(), "deleted material draft");
        await navigate("/away"); await click("继续编辑");
        await navigate("/away"); await click("放弃并离开"); await page.waitForFunction(() => window.b01.location() === "/away");
    });

    await test("deleted episode keeps its shot slot and guard mounted through read gates", async () => {
        await navigate(shotPath(ids.ea)); await eventually("h1", "制作分镜");
        await page.getByRole("button", {name: /镜头 .*· 首帧/}).first().click();
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill("deleted episode draft");
        await page.evaluate(id => window.b01.db.episodes.delete(id), ids.ea);
        await eventually("[role=alert]", "未完成的修改仍保留");
        assert.equal(await page.getByRole("button", {name: "保存", exact: true}).isDisabled(), true);
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).getAttribute("readonly"), "");
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "deleted episode draft");
        await navigate("/away"); await click("继续编辑");
        await navigate("/away"); await click("放弃并离开"); await page.waitForFunction(() => window.b01.location() === "/away");
    });

    await test("clean deleted project exposes not-found with project controls hidden", async () => {
        const id = await page.evaluate(async () => (await window.b01.projects.createProject("Clean deletion", "series")).id);
        await navigate(`/p/${id}/world`); await eventually("span", "Clean deletion");
        await click("项目设定");
        await page.evaluate(id => window.b01.db.projects.delete(id), id);
        await eventually("[role=alert]", "找不到这个项目");
        await page.getByRole("dialog", {name: "项目设定"}).waitFor({state: "detached"});
        assert.equal(await page.getByText("Clean deletion", {exact: true}).isVisible(), false);
        assert.equal(await page.getByRole("button", {name: "项目设定", exact: true}).count(), 0);
        assert.equal(await page.locator("[inert]").count(), 1);
        await navigate("/away"); await page.waitForFunction(() => window.b01.location() === "/away");
        assert.equal(await page.getByRole("alertdialog").count(), 0);
        await navigate(`/p/${id}/world`); await eventually("p", "找不到这个项目");
    });

    await test("dirty output deletion preserves readable draft and explicit close/discard", async () => {
        const id = await page.evaluate(async () => (await window.b01.projects.createProject("Dirty deletion", "film")).id);
        await navigate(`/p/${id}/world`); await eventually("span", "Dirty deletion"); await click("项目设定");
        await page.getByRole("combobox", {name: "项目目标画幅"}).click();
        await page.getByRole("option", {name: /1:1/}).click();
        await eventually("[role=status]", "输出配置尚未保存");
        await page.locator("[role=listbox]").waitFor({state: "detached"});
        await page.evaluate(async id => {
            await window.b01.db.projects.delete(id);
            await window.b01.db.episodes.where("projectId").equals(id).delete();
        }, id);
        await eventually("[role=alert]", "找不到这个项目");
        assert.equal(await page.getByRole("dialog", {name: "项目设定"}).count(), 1);
        assert.equal(await page.getByRole("combobox", {name: "项目目标画幅"}).textContent().then(value => value.includes("1:1")), true);
        assert.equal(await page.getByRole("button", {name: "保存输出配置", exact: true}).isDisabled(), true);
        await navigate("/away"); await click("继续编辑");
        assert.equal(await location(), `/p/${id}/world`);
        await click("完成"); await click("放弃输出修改");
        await page.locator('[data-slot="dialog-content"]').waitFor({state: "detached"});
        await navigate("/away"); await page.waitForFunction(() => window.b01.location() === "/away");
    });

    await test("missing and foreign-owner asset identities never expose an editor", async () => {
        for (const kind of ["character", "scene", "prop", "style"]) {
            await page.evaluate(({kind}) => window.b01.hold(`${kind === "character" ? "characters" : kind === "scene" ? "scenes" : kind === "prop" ? "props" : "styles"}:missing`), {kind});
            await navigate(`/asset/${ids.a}/${kind}/missing`); await eventually("div", "加载中");
            assert.equal(await page.getByRole("button", {name: /·/}).count(), 0);
            await page.evaluate(({kind}) => window.b01.release(`${kind === "character" ? "characters" : kind === "scene" ? "scenes" : kind === "prop" ? "props" : "styles"}:missing`), {kind});
            await eventually("p", "找不到");
            await navigate(`/asset/${ids.b}/${kind}/${ids.rows[kind][1].id}`); await eventually("p", "找不到");
            assert.equal(await page.getByRole("button", {name: /·/}).count(), 0);
        }
        await navigate(`/p/${ids.b}/e/${ids.eb}/shots`); await eventually("p", "找不到这一集");
    });

    await test("history back honors dirty guard and registers unload protection", async () => {
        await navigate(assetPath("scene")); await eventually("h1", "场景");
        await navigate(assetPath("scene", 1)); await eventually("h1", "场景");
        await page.getByRole("button", {name: /·/}).first().click();
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill("history draft");
        await page.waitForFunction(() => window.b01.router.history._getBlockers().some(blocker => blocker.enableBeforeUnload === true));
        assert.equal(await page.evaluate(() => {
            const event = new Event("beforeunload", {cancelable: true});
            window.dispatchEvent(event);
            return event.defaultPrevented;
        }), true);
        await page.evaluate(() => window.b01.router.history.back());
        await eventually("[role=alertdialog]", "保留未保存");
        assert.equal(await location(), assetPath("scene", 1)); await click("继续编辑");
        assert.equal(await page.getByRole("textbox", {name: "画面描述 / 提示词"}).inputValue(), "history draft");
        await page.evaluate(() => window.b01.router.history.back()); await click("放弃并离开");
        await page.waitForFunction(path => window.b01.location() === path, assetPath("scene"));
        await page.waitForFunction(() => window.b01.router.history._getBlockers().every(blocker => blocker.enableBeforeUnload !== true));
        assert.equal(await page.evaluate(() => {
            const event = new Event("beforeunload", {cancelable: true});
            window.dispatchEvent(event);
            return event.defaultPrevented;
        }), false);
    });

    await test("slot pending save blocks navigation until completion and persists original target", async () => {
        await navigate(assetPath("character", 1));
        await page.getByRole("button", {name: /·/}).first().click();
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).fill("pending save draft");
        await page.evaluate(() => window.b01.hold("setCharacterSlot")); await click("保存");
        await navigate(assetPath("character")); await eventually("[role=alertdialog]", "正在处理");
        assert.equal(await page.getByRole("button", {name: "放弃并离开", exact: true}).count(), 0);
        assert.equal(await location(), assetPath("character", 1)); await click("继续编辑");
        await page.evaluate(() => window.b01.release("setCharacterSlot"));
        await page.getByRole("textbox", {name: "画面描述 / 提示词"}).waitFor({state: "detached"});
        assert.equal(await page.evaluate(id => window.b01.db.characters.get(id).then(row => row.slots.front.prompt), ids.rows.character[1].id), "pending save draft");
        assert.equal(await page.evaluate(id => window.b01.db.characters.get(id).then(row => row.slots.front.prompt), ids.rows.character[0].id), "theirs");
    });

    console.log(`B01 browser regressions: ${passed} passed`);
} finally {
    await browser?.close();
    await server.close();
    await rm(cacheDirectory, {recursive: true, force: true});
}
