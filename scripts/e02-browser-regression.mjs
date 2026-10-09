import assert from "node:assert/strict";
import {readFile, writeFile, mkdtemp, mkdir, rm} from "node:fs/promises";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const baseline = process.env.E02_BASELINE === "1";
const surrogate = process.env.E02_SAFE_AREA_SURROGATE === "1";
let mode = "after";
if (baseline) mode = "before";
else if (surrogate) mode = "after-safe-area-surrogate";
const output = process.env.E02_OUTPUT ?? await mkdtemp(join(tmpdir(), `e02-${mode}-`));
await mkdir(output, {recursive: true});
const snapshotRoot = new URL("../tests/fixtures/sourceSnapshots/e02/", import.meta.url);
const provenance = JSON.parse(await readFile(new URL("provenance.json", snapshotRoot), "utf8"));
for (const file of provenance.files) {
    const bytes = await readFile(new URL(file.snapshotPath, new URL("../", import.meta.url)));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
}
const comparison = {
    name: "e02-original-source-and-labelled-safe-area-surrogate", enforce: "pre",
    async transform(source, id) {
        for (const name of ["TopicSidebar.tsx", "agentChat.css"]) {
            if (baseline && id.endsWith(`/src/components/agent/${name}`)) source = await readFile(new URL(name, snapshotRoot), "utf8");
        }
        if (surrogate && id.endsWith("/src/components/agent/agentChat.css")) {
            assert.ok(source.includes("env(safe-area-inset-bottom, 0px)"));
            source = source.replaceAll("env(safe-area-inset-bottom, 0px)", "var(--e02-test-safe-area-bottom, 0px)");
        }
        return source;
    },
};
const cacheDirectory = await mkdtemp(join(tmpdir(), "e02-vite-cache-"));
const server = await createServer({configFile: false, cacheDir: cacheDirectory,
    plugins: [comparison, react(), tailwindcss()],
    optimizeDeps: {entries: [fileURLToPath(new URL("../tests/fixtures/e02/index.html", import.meta.url))]},
    resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}},
    server: {host: "127.0.0.1", port: 5199, strictPort: true, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**"]}},
});
const {chromium} = await import(process.env.E02_PLAYWRIGHT_PATH ?? "playwright");
const require = createRequire(import.meta.url);
const playwrightEntry = process.env.E02_PLAYWRIGHT_PATH ?? import.meta.resolve("playwright");
const playwrightPackage = fileURLToPath(new URL("./package.json", new URL(playwrightEntry, "file://")));
const report = {mode, safeAreaEvidence: surrogate ? "CSS env-to-custom-property test surrogate; no OS/device emulation" : "Actual Chromium env bottom 0; no iOS/device claim",
    versions: {node: process.version, vite: require("vite/package.json").version, playwright: require(playwrightPackage).version},
    cases: [], errors: [], documents: [], styles: [], expanded: [], scroll: [], focus: []};
let browser, page, url;
const persist = () => writeFile(join(output, "observations.json"), JSON.stringify(report, null, 2) + "\n");
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.E02_CHROMIUM_PATH ? {executablePath: process.env.E02_CHROMIUM_PATH} : {})});
    report.versions.chromium = browser.version();
    page = await browser.newPage({viewport: {width: 1440, height: 900}});
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("request", request => {if (request.resourceType() === "document" && request.frame() === page.mainFrame()) report.documents.push(request.url());});
    url = server.resolvedUrls.local[0] + "tests/fixtures/e02/";
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.e02));
    await page.locator(".agent-message-list .agent-content").waitFor();
    const test = async (name, run) => {
        try {
            await run();
            assert.deepEqual(report.errors, []);
            assert.deepEqual(report.documents, [url], "one explicit HTML document; no fixture reload");
            report.cases.push({name, outcome: "pass"});
            console.log(`PASS ${mode}: ${name}`);
        } catch (error) {
            report.cases.push({name, outcome: "fail", error: String(error)});
            await page.screenshot({path: join(output, "failure.png"), fullPage: true});
            await writeFile(join(output, "failure.html"), await page.content());
            throw error;
        } finally {await persist();}
    };
    const row = title => page.locator(".agent-topic-row").filter({has: page.locator(".agent-topic-row-title", {hasText: title})});
    const currentLocation = () => page.evaluate(() => window.e02.location());
    const reset = async () => {
        await page.evaluate(() => window.e02.reset());
        await page.waitForFunction(() => document.querySelector(".agent-topic-row.is-active")?.textContent.includes("Selected topic A"));
        await page.mouse.move(1400, 0);
    };
    const tabTo = async locator => {
        // The anchor is the only programmatic focus; every target is reached by real Tab.
        await page.locator("#keyboard-start").focus();
        for (let count = 0; count < 80; count++) {
            await page.keyboard.press("Tab");
            if (await locator.evaluateAll(elements => elements.some(element => element === document.activeElement))) return;
        }
        throw new Error("Tab did not reach expected production control");
    };
    const selectedA = async () => {
        assert.equal(await currentLocation(), "/agent/e02-a");
        assert.ok((await page.locator(".agent-topic-row.is-active").textContent()).includes("Selected topic A"));
    };
    if (baseline) {
        await test("reproduce inactive keyboard row without reachable child actions", async () => {
            await reset(); await tabTo(row("Inactive topic B"));
            assert.equal(await row("Inactive topic B").locator(".agent-topic-row-actions").count(), 0);
            await page.keyboard.press("Tab");
            assert.equal(await row("Inactive topic B").evaluate(element => element.contains(document.activeElement)), false);
            await selectedA();
        });
        await test("reproduce bubbled child Enter selecting parent without rename", async () => {
            await reset(); await row("Inactive topic B").hover();
            await tabTo(row("Inactive topic B").locator("[role=button]").filter({has: page.locator("svg.lucide-pencil")}));
            await page.keyboard.press("Enter");
            await page.waitForFunction(() => window.e02.location() === "/agent/e02-b");
            assert.equal(await page.getByRole("dialog", {name: "重命名话题"}).count(), 0);
        });
    } else if (!surrogate) {
        for (const key of ["Enter", "Space"]) {
            await test(`inactive row Tab rename ${key} targets B and preserves selection A`, async () => {
                await reset(); const target = row("Inactive topic B");
                assert.equal(await target.evaluate(element => element.matches(":hover")), false);
                assert.equal(await target.locator(".agent-topic-row-actions").evaluate(element => getComputedStyle(element).opacity), "0");
                await tabTo(target.getByRole("button", {name: "Inactive topic B", exact: true}));
                assert.equal(await target.locator(".agent-topic-row-actions").evaluate(element => getComputedStyle(element).opacity), "1");
                const rowFocus = await target.getByRole("button", {name: "Inactive topic B", exact: true}).evaluate(element => ({tag: element.tagName, shadow: getComputedStyle(element).boxShadow, hovered: element.parentElement.matches(":hover")}));
                assert.equal(rowFocus.tag, "BUTTON"); assert.notEqual(rowFocus.shadow, "none"); assert.equal(rowFocus.hovered, false);
                await page.keyboard.press("Tab");
                assert.equal(await target.getByRole("button", {name: "重命名", exact: true}).evaluate(element => element === document.activeElement), true);
                const actionFocus = await target.getByRole("button", {name: "重命名", exact: true}).evaluate(element => ({tag: element.tagName, shadow: getComputedStyle(element).boxShadow}));
                assert.equal(actionFocus.tag, "BUTTON"); assert.notEqual(actionFocus.shadow, "none");
                report.focus.push({key, rowFocus, actionFocus});
                await page.keyboard.press(key);
                const dialog = page.getByRole("dialog", {name: "重命名话题"}); await dialog.waitFor();
                assert.equal(await dialog.locator("input").inputValue(), "Inactive topic B"); await selectedA();
                await dialog.locator("input").fill(`Renamed B ${key}`);
                await dialog.getByRole("button", {name: "确定", exact: true}).click(); await dialog.waitFor({state: "hidden"});
                assert.equal(await page.evaluate(() => window.e02.db.chatThreads.get("e02-b").then(thread => thread.title)), `Renamed B ${key}`);
                assert.equal(await page.evaluate(() => window.e02.db.chatThreads.get("e02-a").then(thread => thread.title)), "Selected topic A");
                await selectedA();
            });
            await test(`inactive row Tab delete ${key} targets C and preserves selection A`, async () => {
                await reset(); const target = row("Inactive topic C");
                await tabTo(target.getByRole("button", {name: "Inactive topic C", exact: true}));
                await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
                assert.equal(await target.getByRole("button", {name: "删除", exact: true}).evaluate(element => element === document.activeElement), true);
                await page.keyboard.press(key);
                const dialog = page.getByRole("alertdialog", {name: "删除话题"}); await dialog.waitFor();
                assert.ok((await dialog.textContent()).includes("Inactive topic C")); await selectedA();
                await dialog.getByRole("button", {name: "删除", exact: true}).click(); await dialog.waitFor({state: "hidden"});
                assert.equal(await page.evaluate(() => window.e02.db.chatThreads.get("e02-c").then(Boolean)), false);
                assert.equal(await page.evaluate(() => window.e02.db.chatThreads.get("e02-a").then(Boolean)), true);
                await selectedA();
            });
            await test(`row own ${key} selects inactive B without opening actions`, async () => {
                await reset(); await tabTo(row("Inactive topic B").getByRole("button", {name: "Inactive topic B", exact: true}));
                await page.keyboard.press(key); await page.waitForFunction(() => window.e02.location() === "/agent/e02-b");
                assert.equal(await page.getByRole("dialog").count(), 0); assert.equal(await page.getByRole("alertdialog").count(), 0);
            });
        }
        await test("hover and pointer actions preserve target, active actions persist, row pointer selects", async () => {
            await reset(); const target = row("Inactive topic B");
            assert.equal(await row("Selected topic A").locator(".agent-topic-row-actions").evaluate(element => getComputedStyle(element).opacity), "1");
            await target.hover(); assert.equal(await target.locator(".agent-topic-row-actions").evaluate(element => getComputedStyle(element).opacity), "1");
            await target.getByRole("button", {name: "重命名", exact: true}).click();
            const rename = page.getByRole("dialog", {name: "重命名话题"}); await rename.waitFor();
            assert.equal(await rename.locator("input").inputValue(), "Inactive topic B"); await selectedA(); await page.keyboard.press("Escape"); await rename.waitFor({state: "hidden"});
            await target.getByRole("button", {name: "删除", exact: true}).click();
            const deletion = page.getByRole("alertdialog", {name: "删除话题"}); await deletion.waitFor();
            assert.ok((await deletion.textContent()).includes("Inactive topic B")); await selectedA();
            await deletion.getByRole("button", {name: "取消", exact: true}).click(); await deletion.waitFor({state: "hidden"});
            await target.getByRole("button", {name: "Inactive topic B", exact: true}).click();
            await page.waitForFunction(() => window.e02.location() === "/agent/e02-b");
        });
        await test("actual header context menu routes rename/delete to selected A", async () => {
            await reset();
            const more = page.locator(".agent-chat-header [role=button]").filter({has: page.locator("svg.lucide-ellipsis")});
            await more.click(); await page.getByRole("menuitem", {name: "重命名", exact: true}).click();
            const rename = page.getByRole("dialog", {name: "重命名话题"}); await rename.waitFor();
            assert.equal(await rename.locator("input").inputValue(), "Selected topic A"); await page.keyboard.press("Escape"); await rename.waitFor({state: "hidden"});
            await more.click(); await page.getByRole("menuitem", {name: "删除", exact: true}).click();
            const deletion = page.getByRole("alertdialog", {name: "删除话题"}); await deletion.waitFor();
            assert.ok((await deletion.textContent()).includes("Selected topic A"));
            await deletion.getByRole("button", {name: "取消", exact: true}).click(); await deletion.waitFor({state: "hidden"}); await selectedA();
        });
    }
    await reset();
    if (surrogate) await page.evaluate(() => document.documentElement.style.setProperty("--e02-test-safe-area-bottom", "32px"));
    for (const width of [390, 767, 768, 1440]) {
        await test(`actual ChatWorkspace computed layout at ${width}px`, async () => {
            await page.setViewportSize({width, height: 900});
            await page.locator(".agent-message-list .agent-content").waitFor();
            await page.waitForFunction(() => {
                const dock = document.querySelector(".agent-composer-dock"), column = dock.parentElement;
                return Math.abs(parseFloat(getComputedStyle(column).getPropertyValue("--agent-chat-composer-safe")) - dock.getBoundingClientRect().height - 16) < 1;
            });
            const measurement = await page.evaluate(() => {
                const get = selector => document.querySelector(selector);
                const style = element => {const css = getComputedStyle(element); const rect = element.getBoundingClientRect();
                    return {paddingLeft: css.paddingLeft, paddingRight: css.paddingRight, paddingTop: css.paddingTop, paddingBottom: css.paddingBottom,
                        marginLeft: css.marginLeft, marginRight: css.marginRight, maxWidth: css.maxWidth, width: rect.width, left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top};};
                const list = get(".agent-message-list"), dock = get(".agent-composer-dock"), column = get(".agent-chat-column");
                const envProbe = document.createElement("div");
                envProbe.style.cssText = "position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)";
                document.body.append(envProbe);
                const nativeEnvBottom = getComputedStyle(envProbe).paddingBottom; envProbe.remove();
                return {nativeEnvBottom, width: innerWidth, list: style(list), content: style(list.querySelector(".agent-content")), dock: style(dock), dockContent: style(dock.querySelector(".agent-content")), header: style(get(".agent-chat-header")), column: style(column),
                    composerSafe: getComputedStyle(column).getPropertyValue("--agent-chat-composer-safe"), overflow: {list: getComputedStyle(list).overflowY, document: document.documentElement.scrollWidth > innerWidth},
                    safeArea: getComputedStyle(document.documentElement).getPropertyValue("--e02-test-safe-area-bottom") || "native env"};
            });
            report.styles.push(measurement);
            const narrow = width < 768, mobileFixed = narrow && !baseline;
            const gutter = mobileFixed ? "8px" : "16px";
            assert.equal(measurement.list.paddingLeft, gutter); assert.equal(measurement.list.paddingRight, gutter);
            assert.equal(measurement.list.paddingTop, "68px", "header clearance stays 52+16");
            assert.equal(measurement.dock.paddingLeft, gutter); assert.equal(measurement.dock.paddingRight, gutter);
            let expectedBottom = "16px";
            if (mobileFixed) expectedBottom = surrogate ? "32px" : "12px";
            assert.equal(measurement.nativeEnvBottom, "0px");
            assert.equal(measurement.dock.paddingBottom, expectedBottom);
            assert.equal(measurement.content.maxWidth, mobileFixed ? "none" : "800px");
            assert.equal(measurement.dockContent.maxWidth, mobileFixed ? "none" : "800px");
            if (mobileFixed) {assert.equal(measurement.content.marginLeft, "0px"); assert.equal(measurement.content.marginRight, "0px");}
            assert.equal(measurement.overflow.document, false); assert.equal(measurement.overflow.list, "auto");
            assert.equal(measurement.dock.bottom, measurement.column.bottom);
            assert.equal(measurement.list.paddingBottom, measurement.composerSafe.trim());
            assert.equal(measurement.header.paddingLeft, narrow ? "44px" : "16px");
            if (width === 1440) {assert.equal(measurement.content.width, 800); assert.ok(parseFloat(measurement.content.marginLeft) > 0);}
            // Real wheel scroll, then inspect the final production message above the dock.
            await page.locator(".agent-message-list").hover(); await page.mouse.wheel(0, 10000);
            await page.waitForFunction(() => {const list = document.querySelector(".agent-message-list"); return list.scrollHeight - list.scrollTop - list.clientHeight <= 2;});
            const last = page.locator(".agent-message-list").getByText("FINAL MESSAGE END", {exact: true});
            const bounds = await last.boundingBox(); assert.ok(bounds && bounds.height > 0);
            const scroll = await page.locator(".agent-message-list").evaluate(element => ({scrollTop: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight}));
            report.scroll.push({width, bounds, dockTop: measurement.dock.top, ...scroll});
            assert.ok(scroll.scrollTop > 0, "long transcript actually scrolls");
            assert.ok(bounds.y >= measurement.header.bottom, "final message end is visibly below the header");
            assert.ok(bounds.y + bounds.height <= measurement.dock.top + 1, "final message end remains visibly above composer dock");
            await page.screenshot({path: join(output, `${width}.png`)});
        });
        await test(`expanded composer remains full column at ${width}px`, async () => {
            await page.getByRole("button", {name: "展开编辑器", exact: true}).click();
            const expanded = await page.locator(".agent-composer-dock.is-expanded").evaluate(element => {
                const style = getComputedStyle(element), content = getComputedStyle(element.querySelector(".agent-content"));
                const rect = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect();
                return {padding: style.padding, maxWidth: content.maxWidth, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, parent: {x: parent.x, y: parent.y, width: parent.width, height: parent.height}, inert: document.querySelector(".agent-transcript-container").inert};
            });
            report.expanded.push({width, ...expanded});
            assert.equal(expanded.padding, "0px"); assert.equal(expanded.maxWidth, "none"); assert.deepEqual(expanded.rect, expanded.parent); assert.equal(expanded.inert, true);
            await page.screenshot({path: join(output, `${width}-expanded.png`)});
            await page.getByRole("button", {name: "退出全屏编辑", exact: true}).click();
            await page.waitForFunction(() => !document.querySelector(".agent-composer-dock.is-expanded"));
        });
    }
    await test("turn rail keeps its specific 24px gutter at narrow and desktop widths", async () => {
        await page.evaluate(() => window.e02.turns(6));
        await page.locator(".has-turn-navigation .agent-message-list").waitFor();
        for (const width of [390, 1440]) {
            await page.setViewportSize({width, height: 900});
            const style = await page.locator(".has-turn-navigation .agent-message-list").evaluate(element => ({left: getComputedStyle(element).paddingLeft, right: getComputedStyle(element).paddingRight}));
            assert.equal(style.left, "24px"); assert.equal(style.right, width < 768 && !baseline ? "8px" : "16px");
        }
    });
    console.log(`E02 ${mode}: ${report.cases.length} passed; ${output}`);
} finally {
    await persist(); await browser?.close(); await server.close(); await rm(cacheDirectory, {recursive: true, force: true});
}
