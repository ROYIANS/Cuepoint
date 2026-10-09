import assert from "node:assert/strict";
import {prepareNativeFixture} from "./native-fixture-ready.mjs";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const {chromium} = await import(process.env.E01_PLAYWRIGHT_PATH ?? "playwright");
const commands = {
    "/src/db/projects.ts": ["renameProject", "createProject", "createAudioMusicProject"],
    "/src/db/cascadeCommands.ts": ["deleteProject", "setProjectArchived"],
    "/src/db/ipProfiles.ts": ["bindProjectIp"],
    "/src/db/assets.ts": ["addCharacter", "addScene", "addProp", "addStyle", "deleteCharacter", "deleteScene", "deleteProp", "deleteStyle"],
    "/src/db/episodes.ts": ["addEpisode", "reorderEpisodes", "deleteEpisode"],
};
const transport = {
    name: "e01-controlled-repository", enforce: "pre",
    transform(source, id) {
        for (const [suffix, names] of Object.entries(commands)) {
            if (!id.endsWith(suffix)) continue;
            for (const name of names) {
                const declaration = `export async function ${name}(`;
                assert.ok(source.includes(declaration), `Missing exported repository boundary ${name}`);
                source = source.replace(declaration, `async function _e01_${name}(`);
                source += `\nexport async function ${name}(...args: Parameters<typeof _e01_${name}>) {
                    const fixture = typeof window === "undefined" ? undefined : (window as any).e01Writes;
                    if (fixture) await fixture.before("${name}", args);
                    return _e01_${name}(...args);
                }\n`;
            }
        }
        return source;
    },
};
const cacheDir = await mkdtemp(join(tmpdir(), "e01-writes-vite-"));
const server = await createServer({configFile: false, cacheDir, optimizeDeps: {holdUntilCrawlEnd: false, entries: [fileURLToPath(new URL("../tests/fixtures/e01-writes/index.html", import.meta.url))]}, plugins: [transport, react(), tailwindcss()], resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**", "**/tests/fixtures/e01-drafts/**"]}}});
let browser;
let passed = 0;
try {
    await server.listen();
    await prepareNativeFixture(server, "/tests/fixtures/e01-writes/harness.tsx");
    browser = await chromium.launch({headless: true, ...(process.env.E01_CHROMIUM_PATH ? {executablePath: process.env.E01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], documents = [];
    page.on("request", request => {if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());});
    page.on("pageerror", error => {errors.push(error.message); console.error("pageerror", error.message);});
    const fixtureUrl = server.resolvedUrls.local[0] + "tests/fixtures/e01-writes/";
    await page.goto(fixtureUrl);
    await page.waitForFunction(() => Boolean(window.e01Writes));
    const ids = await page.evaluate(() => window.e01Writes.ids);
    const navigate = async path => {
        await page.evaluate(path => window.e01Writes.navigate(path), path);
        await page.waitForFunction(path => window.e01Writes.location() === path, path);
    };
    const count = name => page.evaluate(name => window.e01Writes.calls.filter(call => call.name === name).length, name);
    const arm = async name => {await page.evaluate(name => {window.e01Writes.hold(name); window.e01Writes.failures.add(name);}, name); return count(name);};
    const release = name => page.evaluate(name => window.e01Writes.release(name), name);
    const retry = name => page.evaluate(name => window.e01Writes.failures.delete(name), name);
    const callsReached = (name, n) => page.waitForFunction(({name, n}) => window.e01Writes.calls.filter(call => call.name === name).length === n, {name, n});
    const button = name => page.getByRole("button", {name, exact: true});
    const activateTwice = locator => locator.evaluate(element => {element.click(); element.click();});
    const menu = async (title, action) => {
        await button(`${title} 操作`).click();
        await page.getByRole("menuitem", {name: action, exact: true}).click();
    };
    const pendingClose = async (dialog, draft) => {
        await page.keyboard.press("Escape");
        await page.mouse.click(5, 5);
        const cancel = dialog.getByRole("button", {name: "取消", exact: true});
        assert.equal(await cancel.isDisabled(), true);
        await cancel.evaluate(element => element.click());
        const close = dialog.getByRole("button", {name: "关闭", exact: true});
        if (await close.count()) await close.click();
        assert.equal(await dialog.isVisible(), true);
        if (draft !== undefined) assert.equal(await dialog.getByRole("textbox").inputValue(), draft);
    };
    const test = async (name, run) => {
        try {
            await run(); assert.deepEqual(errors, []); assert.deepEqual(documents, [fixtureUrl], "fixture retains its only explicit main document"); passed++; console.log(`PASS ${name}`);
        } catch (error) {
            const directory = await mkdtemp(join(tmpdir(), "e01-writes-failure-"));
            await page.screenshot({path: join(directory, "failure.png"), fullPage: true});
            await writeFile(join(directory, "failure.html"), await page.content());
            await writeFile(join(directory, "calls.json"), JSON.stringify(await page.evaluate(() => window.e01Writes?.calls), null, 2));
            console.error(`FAIL ${name}; ${passed} passed; artifacts: ${directory}`);
            throw error;
        }
    };

    await test("gallery rename rejection preserves exact draft; pending dismissal and duplicate save blocked; retry writes captured project", async () => {
        await menu("Rename owner", "重命名");
        const dialog = page.getByRole("dialog", {name: "重命名项目"});
        const draft = "  原样草稿 · retry  \n";
        await dialog.getByRole("textbox").fill(draft);
        // Input type=text normalizes newlines; capture the actual submitted user input.
        const exact = await dialog.getByRole("textbox").inputValue();
        const before = await arm("renameProject");
        await activateTwice(dialog.getByRole("button", {name: "保存", exact: true}));
        await callsReached("renameProject", before + 1);
        await pendingClose(dialog, exact);
        assert.equal(await count("renameProject"), before + 1);
        await release("renameProject");
        await dialog.getByRole("alert").waitFor();
        assert.equal(await dialog.getByRole("textbox").inputValue(), exact);
        assert.equal(await page.evaluate(id => window.e01Writes.db.projects.get(id).then(row => row.name), ids.rename), "Rename owner");
        await retry("renameProject"); await dialog.getByRole("button", {name: "保存", exact: true}).click();
        await dialog.waitFor({state: "detached"});
        assert.equal(await page.evaluate(id => window.e01Writes.db.projects.get(id).then(row => row.name), ids.rename), exact.trim());
    });

    for (const [kind, label, command] of [["video", "视频", "createProject"], ["audio", "音频", "createAudioMusicProject"], ["music", "音乐", "createAudioMusicProject"]]) {
        await test(`gallery ${kind} creation retains exact name/kind on rejection, pending close and duplicate protected, retry opens owned project`, async () => {
            await button("新建项目").click();
            const dialog = page.getByRole("dialog", {name: "新建项目"});
            await dialog.getByRole("button", {name: new RegExp(`^${label}`)}).click();
            const draft = `  ${kind} 原样名称 · retry  `;
            await dialog.getByRole("textbox", {name: "项目名称"}).fill(draft);
            const before = await arm(command);
            await activateTwice(dialog.getByRole("button", {name: "创建项目", exact: true}));
            await callsReached(command, before + 1); await pendingClose(dialog, draft);
            const failureText = `写入失败：${command}，请重试`;
            await page.evaluate(() => {window.e01WritesPreviousToasts = new Set(document.querySelectorAll("[data-sonner-toast] [data-title]"));});
            await release(command);
            await page.waitForFunction(text => Array.from(document.querySelectorAll("[data-sonner-toast] [data-title]"))
                .some(element => element.textContent === text && !window.e01WritesPreviousToasts.has(element)), failureText);
            assert.equal(await dialog.getByRole("textbox", {name: "项目名称"}).inputValue(), draft);
            assert.equal(await dialog.getByRole("button", {name: new RegExp(`^${label}`)}).getAttribute("aria-pressed"), "true");
            await retry(command); await dialog.getByRole("button", {name: "创建项目", exact: true}).click();
            await page.waitForFunction(() => window.e01Writes.location().startsWith("/p/"));
            const row = await page.evaluate(() => window.e01Writes.db.projects.get(window.e01Writes.location().split("/")[2]));
            assert.equal(row.name, draft.trim()); assert.equal(row.kind ?? "video", kind);
            assert.equal(await count(command), before + 2);
            await navigate("/gallery");
        });
    }

    await test("gallery project deletion keeps confirmation target after rejection and deletes only on retry", async () => {
        await menu("Delete owner", "删除");
        const dialog = page.getByRole("alertdialog", {name: "删除项目"});
        const before = await arm("deleteProject");
        await activateTwice(dialog.getByRole("button", {name: "删除", exact: true}));
        await callsReached("deleteProject", before + 1); await pendingClose(dialog);
        await release("deleteProject"); await dialog.getByRole("alert").waitFor();
        assert.ok(await page.evaluate(id => window.e01Writes.db.projects.get(id), ids.deletion));
        await retry("deleteProject"); await dialog.getByRole("button", {name: "删除", exact: true}).click();
        await dialog.waitFor({state: "detached"});
        assert.equal(await page.evaluate(id => window.e01Writes.db.projects.get(id), ids.deletion), undefined);
        assert.equal(await page.evaluate(id => window.e01Writes.db.episodes.where("projectId").equals(id).count(), ids.deletion), 0);
        assert.ok(await page.evaluate(id => window.e01Writes.db.projects.get(id), ids.rename));
        assert.equal(await count("deleteProject"), before + 2);
    });

    await test("IP binding rejection retains selection; synchronous duplicate and pending close protected", async () => {
        await menu("Binding owner", "所属 IP");
        const dialog = page.getByRole("dialog", {name: "项目所属 IP"});
        await dialog.getByRole("combobox", {name: "所属 IP"}).click();
        await page.getByRole("option", {name: "Fixture IP", exact: true}).click();
        const before = await arm("bindProjectIp");
        await activateTwice(dialog.getByRole("button", {name: "保存", exact: true}));
        await callsReached("bindProjectIp", before + 1); await pendingClose(dialog);
        await release("bindProjectIp"); await dialog.getByRole("alert").waitFor();
        assert.equal(await dialog.getByRole("combobox").textContent(), "Fixture IP");
        await retry("bindProjectIp"); await dialog.getByRole("button", {name: "保存", exact: true}).click();
        await dialog.waitFor({state: "detached"});
        assert.equal(await page.evaluate(id => window.e01Writes.db.projectIpLinks.where("projectId").equals(id).first().then(row => row.ipId), ids.binding), ids.ip);
        assert.equal(await count("bindProjectIp"), before + 2);
    });

    await test("archive catches failure, blocks repeated activation, and retries same owner", async () => {
        const before = await arm("setProjectArchived");
        await menu("Archive owner", "归档项目"); await callsReached("setProjectArchived", before + 1);
        await menu("Archive owner", "处理中…");
        assert.equal(await count("setProjectArchived"), before + 1);
        await release("setProjectArchived"); await page.getByText("写入失败：setProjectArchived，请重试", {exact: true}).waitFor();
        assert.equal(await page.evaluate(id => window.e01Writes.db.projects.get(id).then(row => Boolean(row.archivedAt)), ids.archive), false);
        await retry("setProjectArchived"); await menu("Archive owner", "归档项目");
        await page.waitForFunction(id => window.e01Writes.db.projects.get(id).then(row => Boolean(row.archivedAt)), ids.archive);
    });

    for (const [kind, route, createLabel, add, remove, table] of [
        ["character", "characters", "创建角色", "addCharacter", "deleteCharacter", "characters"],
        ["scene", "scenes", "创建场景", "addScene", "deleteScene", "scenes"],
        ["prop", "props", "创建道具", "addProp", "deleteProp", "props"],
        ["style", "styles", "创建风格", "addStyle", "deleteStyle", "styles"],
    ]) {
        await test(`${kind} library delete rejection preserves exact target; duplicate/close protection and retry`, async () => {
            await navigate(`/${route}`); await menu(ids.rows[kind].name, "删除");
            const dialog = page.getByRole("alertdialog");
            const description = await dialog.textContent();
            const before = await arm(remove); await activateTwice(dialog.getByRole("button", {name: "删除", exact: true}));
            await callsReached(remove, before + 1); await pendingClose(dialog);
            await release(remove); await dialog.getByRole("alert").waitFor();
            assert.ok((await dialog.textContent()).includes(`确定删除「${ids.rows[kind].name}」？`));
            assert.ok(description.includes(ids.rows[kind].name));
            assert.ok(await page.evaluate(({table, id}) => window.e01Writes.db[table].get(id), {table, id: ids.rows[kind].id}));
            await retry(remove); await dialog.getByRole("button", {name: "删除", exact: true}).click();
            await dialog.waitFor({state: "detached"});
            assert.equal(await page.evaluate(({table, id}) => window.e01Writes.db[table].get(id), {table, id: ids.rows[kind].id}), undefined);
            assert.equal(await count(remove), before + 2);
        });
        await test(`${kind} library creation has one immediate write, caught failure, successful studio route retry`, async () => {
            const before = await arm(add); await activateTwice(page.getByRole("button", {name: new RegExp(`^${createLabel}`)}));
            await callsReached(add, before + 1); assert.equal(await page.getByRole("button", {name: /^创建中…/}).count(), 1);
            await release(add); await page.getByText(`写入失败：${add}，请重试`, {exact: true}).waitFor();
            assert.equal(await page.evaluate(() => window.e01Writes.location()), `/${route}`);
            await retry(add); await page.getByRole("button", {name: new RegExp(`^${createLabel}`)}).click();
            await page.waitForFunction(route => window.e01Writes.location().startsWith(`/${route}/`), route);
            const call = await page.evaluate(name => window.e01Writes.calls.filter(call => call.name === name).at(-1), add);
            assert.equal(call.args[0], "studio");
            assert.equal(await count(add), before + 2);
        });
    }

    await test("episode add catches failure and blocks duplicate; reorder rejection retains order then succeeds with undo", async () => {
        await navigate(`/episodes/${ids.seriesA}`);
        const before = await arm("addEpisode");
        await activateTwice(page.getByRole("button", {name: /新建第/}));
        await callsReached("addEpisode", before + 1); await release("addEpisode");
        await page.getByText("写入失败：addEpisode，请重试", {exact: true}).waitFor();
        await retry("addEpisode"); await page.getByRole("button", {name: /新建第/}).click();
        await page.waitForFunction(id => window.e01Writes.db.episodes.where("projectId").equals(id).count().then(n => n === 4), ids.seriesA);
        const previous = await page.evaluate(id => window.e01Writes.db.episodes.where("projectId").equals(id).sortBy("order"), ids.seriesA);
        const titles = await page.getByRole("button", {name: /操作$/}).allTextContents();
        assert.equal(titles.length, 4);
        const operation = page.getByRole("button", {name: /操作$/}).nth(1);
        const reorderBefore = await arm("reorderEpisodes");
        await operation.click(); await activateTwice(page.getByRole("menuitem", {name: "上移", exact: true}));
        await callsReached("reorderEpisodes", reorderBefore + 1);
        await operation.click(); await page.getByRole("menuitem", {name: "上移", exact: true}).click();
        assert.equal(await count("reorderEpisodes"), reorderBefore + 1);
        await release("reorderEpisodes"); await page.getByText("写入失败：reorderEpisodes，请重试", {exact: true}).waitFor();
        assert.deepEqual(await page.evaluate(id => window.e01Writes.db.episodes.where("projectId").equals(id).sortBy("order").then(rows => rows.map(row => row.id)), ids.seriesA), previous.map(row => row.id));
        await retry("reorderEpisodes"); await operation.click(); await page.getByRole("menuitem", {name: "上移", exact: true}).click();
        const expected = previous.map(row => row.id); [expected[0], expected[1]] = [expected[1], expected[0]];
        await page.waitForFunction(({id, expected}) => window.e01Writes.db.episodes.where("projectId").equals(id).sortBy("order").then(rows => JSON.stringify(rows.map(row => row.id)) === JSON.stringify(expected)), {id: ids.seriesA, expected});
        await button("撤销").click();
        await page.waitForFunction(({id, expected}) => window.e01Writes.db.episodes.where("projectId").equals(id).sortBy("order").then(rows => JSON.stringify(rows.map(row => row.id)) === JSON.stringify(expected)), {id: ids.seriesA, expected: previous.map(row => row.id)});
    });

    await test("episode delete failure retains modal/target, retry deletion and undo restore exact original episode", async () => {
        const target = await page.evaluate(id => window.e01Writes.db.episodes.where("projectId").equals(id).sortBy("order").then(rows => rows[1]), ids.seriesA);
        const shots = await page.evaluate(id => window.e01Writes.db.shots.where("episodeId").equals(id).toArray(), target.id);
        assert.equal(shots.length, 1);
        await page.getByRole("button", {name: /操作$/}).nth(1).click(); await page.getByRole("menuitem", {name: "删除", exact: true}).click();
        const dialog = page.getByRole("alertdialog", {name: "删除这一集"});
        const before = await arm("deleteEpisode"); await activateTwice(dialog.getByRole("button", {name: "删除", exact: true}));
        await callsReached("deleteEpisode", before + 1); await pendingClose(dialog);
        await release("deleteEpisode"); await dialog.getByRole("alert").waitFor();
        assert.ok(await page.evaluate(id => window.e01Writes.db.episodes.get(id), target.id));
        assert.equal((await page.evaluate(() => window.e01Writes.calls.filter(call => call.name === "deleteEpisode").at(-1))).args[0], target.id);
        await retry("deleteEpisode"); await dialog.getByRole("button", {name: "删除", exact: true}).click(); await dialog.waitFor({state: "detached"});
        assert.equal(await page.evaluate(id => window.e01Writes.db.episodes.get(id), target.id), undefined);
        assert.equal(await page.evaluate(id => window.e01Writes.db.shots.where("episodeId").equals(id).count(), target.id), 0);
        await button("撤销").click(); await page.waitForFunction(id => window.e01Writes.db.episodes.get(id).then(Boolean), target.id);
        const restored = await page.evaluate(id => window.e01Writes.db.episodes.get(id), target.id);
        for (const key of ["id", "projectId", "title", "order", "story"]) assert.deepEqual(restored[key], target[key]);
        assert.deepEqual(await page.evaluate(id => window.e01Writes.db.shots.where("episodeId").equals(id).toArray().then(rows => rows.map(row => row.id)), target.id), shots.map(row => row.id));
    });

    await test("old episode owner completion cannot close newer owner's delete selection", async () => {
        await page.getByRole("button", {name: /操作$/}).nth(1).click(); await page.getByRole("menuitem", {name: "删除", exact: true}).click();
        await page.evaluate(() => window.e01Writes.hold("deleteEpisode"));
        await page.getByRole("alertdialog").getByRole("button", {name: "删除", exact: true}).click();
        await navigate(`/episodes/${ids.seriesB}`);
        await page.getByRole("button", {name: /操作$/}).nth(1).click(); await page.getByRole("menuitem", {name: "删除", exact: true}).click();
        const oldTarget = await page.evaluate(() => window.e01Writes.calls.filter(call => call.name === "deleteEpisode").at(-1).args[0]);
        await release("deleteEpisode");
        await page.waitForFunction(id => window.e01Writes.db.episodes.get(id).then(row => row === undefined), oldTarget);
        assert.equal(await page.getByRole("alertdialog", {name: "删除这一集"}).isVisible(), true);
        await page.getByRole("alertdialog").getByRole("button", {name: "取消", exact: true}).click();
    });

    await test("old library create completion cannot navigate newer library selection", async () => {
        await navigate("/characters"); await page.evaluate(() => window.e01Writes.hold("addCharacter"));
        const before = await count("addCharacter"); await page.getByRole("button", {name: /^创建角色/}).click(); await callsReached("addCharacter", before + 1);
        await page.getByRole("button", {name: /操作$/}).first().click(); await page.getByRole("menuitem", {name: "删除", exact: true}).click();
        assert.equal(await page.getByRole("alertdialog").count(), 0);
        await navigate("/scenes"); await release("addCharacter");
        await page.waitForFunction(n => window.e01Writes.db.characters.where("projectId").equals("studio").count().then(count => count >= n), 2);
        assert.equal(await page.evaluate(() => window.e01Writes.location()), "/scenes");
    });
    await test("old gallery creation completion cannot navigate or clear a newer form", async () => {
        await navigate("/gallery"); await button("新建项目").click();
        const before = await count("createProject");
        await page.getByRole("textbox", {name: "项目名称"}).fill("old pending project");
        await page.evaluate(() => window.e01Writes.hold("createProject"));
        await button("创建项目").click(); await callsReached("createProject", before + 1);
        await navigate("/away"); await navigate("/gallery"); await button("新建项目").click();
        await page.getByRole("textbox", {name: "项目名称"}).fill("new form untouched");
        await release("createProject");
        await page.waitForFunction(() => window.e01Writes.db.projects.toArray().then(rows => rows.some(row => row.name === "old pending project")));
        assert.equal(await page.evaluate(() => window.e01Writes.location()), "/gallery");
        assert.equal(await page.getByRole("textbox", {name: "项目名称"}).inputValue(), "new form untouched");
        await page.getByRole("dialog").getByRole("button", {name: "取消", exact: true}).click();
    });

    console.log(`E01 native write regressions: ${passed} passed; page errors: ${errors.length}`);
} finally {
    await browser?.close(); await server.close(); await rm(cacheDir, {recursive: true, force: true});
}
