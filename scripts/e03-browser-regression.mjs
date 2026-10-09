import assert from "node:assert/strict";
import {readFile, writeFile, mkdtemp, mkdir, rm, readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const paired = process.env.E03_PAIRED === "1";
const baseline = process.env.E03_BASELINE === "1", diagnosticPortal = process.env.E03_DIAGNOSTIC_PORTAL === "1", diagnostic = process.env.E03_DIAGNOSTIC_800 === "1" || diagnosticPortal, softwareRaster = process.env.E03_SOFTWARE_RASTER === "1", mode = diagnostic ? (diagnosticPortal ? "diagnostic-portal" : "diagnostic-800") : paired ? "paired" : baseline ? "before" : "after";
if (!baseline && !diagnostic && !paired) assert.ok(process.env.E03_COMPARE, "after requires the saved baseline comparison");
const output = process.env.E03_OUTPUT ?? await mkdtemp(join(tmpdir(), `e03-${mode}-`));
await mkdir(output, {recursive: true});
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const snapshots = new URL("../tests/fixtures/sourceSnapshots/e03/", import.meta.url);
const provenance = JSON.parse(await readFile(new URL("provenance.json", snapshots), "utf8"));
for (const file of provenance.files) assert.equal(hash(await readFile(new URL(file.snapshotPath, new URL("../", import.meta.url)))), file.sha256);
const originalCss = {name: "e03-immutable-original-two-css-only", enforce: "pre", async transform(source, id) {
    if (baseline) for (const file of provenance.files) if (id.endsWith(`/${file.sourcePath}`)) return await readFile(new URL(file.snapshotPath, new URL("../", import.meta.url)), "utf8");
    return source;
}};
const cache = await mkdtemp(join(tmpdir(), "e03-vite-cache-"));
const server = await createServer({configFile: false, cacheDir: cache, plugins: [originalCss, react(), tailwindcss()],
    optimizeDeps: {entries: [fileURLToPath(new URL("../tests/fixtures/e03/index.html", import.meta.url))]},
    resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}},
    server: {host: "127.0.0.1", port: 5203, strictPort: true, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**"]}},
});
const {chromium} = await import(process.env.E03_PLAYWRIGHT_PATH ?? "playwright");
const report = {mode, baselineCssSubstitution: baseline, samePagePaired: paired, diagnostic800: diagnostic && !diagnosticPortal, diagnosticPortal, versions: {node: process.version}, controls: {reducedMotion: "reduce", animation: "CSS animation/transition disabled identically; screenshot animation disabled", raster: softwareRaster ? "Chromium --disable-gpu --force-device-scale-factor=1; software raster only" : "default headless Chromium renderer", scaleFactor: 1, samePageRasterControl: paired ? "Two original CSS applications before original/current comparison; cold and repeated same-source PNGs and exact control differences preserved" : "none", fonts: "actual installed system font stack, document.fonts.ready; no font replacement", media: "local generated 4s PCM WAV; actual decode/waveform; paused and reset before captures", clock: "seeded fixed dates; no clock replacement", device: "headless desktop Chromium resized; no iOS/safe-area/device claim"}, documents: [], errors: [], externalRequests: [], captures: [], interactions: []};
const sourceHashes = {};
const scan = async directory => {for (const entry of await readdir(directory, {withFileTypes: true})) {const path = join(directory, entry.name); if (entry.isDirectory()) await scan(path); else sourceHashes[path] = hash(await readFile(path));}};
await scan("src");
report.sourceHashes = sourceHashes;
report.producerHashes = {};
await mkdir(join(output, "producer-snapshot"), {recursive: true});
for (const path of ["scripts/e03-browser-regression.mjs", "tests/fixtures/e03/harness.tsx", "tests/fixtures/e03/index.html", "tests/fixtures/e03/tsconfig.json", "tests/fixtures/sourceSnapshots/e03/provenance.json", ...provenance.files.map(x => x.sourcePath), ...provenance.files.map(x => x.snapshotPath)]) {
    const bytes = await readFile(path); report.producerHashes[path] = hash(bytes);
    const target = join(output, "producer-snapshot", path); await mkdir(join(target, ".."), {recursive: true}); await writeFile(target, bytes);
}
let browser, page, url;
const persist = () => writeFile(join(output, "observations.json"), JSON.stringify(report, null, 2) + "\n");
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(softwareRaster ? {args: ["--disable-gpu", "--force-device-scale-factor=1"]} : {}), ...(process.env.E03_CHROMIUM_PATH ? {executablePath: process.env.E03_CHROMIUM_PATH} : {})});
    report.versions.chromium = browser.version();
    page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "zh-CN", timezoneId: "Asia/Shanghai"});
    page.setDefaultTimeout(12000);
    page.on("pageerror", error => report.errors.push(`${error.name}: ${error.message} ${error.stack}`));
    page.on("request", request => {if (request.resourceType() === "document" && request.frame() === page.mainFrame()) report.documents.push(request.url());});
    await page.route("**/*", route => {const target = route.request().url(); if (/^https?:/.test(target) && !target.startsWith("http://127.0.0.1:5203/")) {report.externalRequests.push(target); return route.abort();} return route.continue();});
    url = server.resolvedUrls.local[0] + "tests/fixtures/e03/" + (process.env.E03_REPRO_DUPLICATE_INTENT === "1" ? "?duplicateIntent=1" : "");
    await page.goto(url); await page.waitForFunction(() => Boolean(window.e03 || window.e03BootstrapError));
    report.bootstrap = await page.evaluate(() => window.e03BootstrapError ?? {outcome: "ready"});
    assert.equal(report.bootstrap.outcome, "ready", JSON.stringify(report.bootstrap));
    await page.locator(".as-script-input").first().waitFor();
    await page.addStyleTag({content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }"});
    await page.evaluate(() => document.fonts.ready);
    const settle = async () => {
        await page.evaluate(async () => {
            for (const media of document.querySelectorAll("audio")) {media.pause(); media.currentTime = 0;}
            await document.fonts.ready;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        // Allow actual IndexedDB live queries, media loading and pointer hover to settle.
        await page.waitForTimeout(180);
    };
    const comparePixels = async (first, second) => await page.evaluate(async ({first, second}) => {
                const decode = async src => {const image = new Image(); image.src = `data:image/png;base64,${src}`; await image.decode(); const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); return {width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data};};
                const a = await decode(first), b = await decode(second); let differentPixels = 0, maxChannelDelta = 0;
                if (a.width !== b.width || a.height !== b.height) throw new Error("different image dimensions");
                for (let i = 0; i < a.data.length; i += 4) {let changed = false; for (let c = 0; c < 4; c++) {const delta = Math.abs(a.data[i + c] - b.data[i + c]); if (delta) changed = true; maxChannelDelta = Math.max(maxChannelDelta, delta);} if (changed) differentPixels++;}
                return {width: a.width, height: a.height, differentPixels, maxChannelDelta};
            }, {first: first.toString("base64"), second: second.toString("base64")});
    const applyCss = async variant => {
        const texts = await Promise.all(provenance.files.map(async file => ({path: file.sourcePath, text: await readFile(variant === "original" ? file.snapshotPath : file.sourcePath, "utf8")})));
        await page.evaluate(texts => {for (const item of texts) {const element = Array.from(document.querySelectorAll("style[data-vite-dev-id]")).find(x => x.dataset.viteDevId.endsWith(item.path)); if (!element) throw new Error(`Missing actual stylesheet ${item.path}`); element.textContent = item.text;}}, texts);
        return texts.map(x => ({path: x.path, sha256: hash(x.text)}));
    };
    const fullStyleState = () => page.evaluate(() => Array.from(document.querySelectorAll("body, body *")).map(element => {
        const properties = pseudo => {const style = getComputedStyle(element, pseudo); return Object.fromEntries(Array.from(style).map(key => [key, style.getPropertyValue(key)]));};
        return {tag: element.tagName, class: element.getAttribute("class"), attributes: Object.fromEntries(Array.from(element.attributes).map(x => [x.name, x.value])), leafText: element.childElementCount === 0 && !["STYLE", "SCRIPT"].includes(element.tagName) ? element.textContent : null, value: "value" in element ? element.value : null, focused: element === document.activeElement, hovered: element.matches(":hover"), rect: element.getBoundingClientRect().toJSON(), styles: properties(null), before: properties("::before"), after: properties("::after")};
    }));
    const capture = async name => {
        await page.mouse.move(0, 0); await settle();
        const measurements = await page.evaluate(() => {
            const selectors = '[class*="aw-"], [class*="as-"], [class*="at-"], [class*="mw-"], [role="dialog"], [role="listbox"], [role="menu"], [data-slot="select-content"]';
            const properties = ["display", "position", "width", "height", "padding", "margin", "gap", "gridTemplateColumns", "gridTemplateRows", "fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "backgroundColor", "border", "borderRadius", "boxShadow", "overflow", "opacity", "transform"];
            return Array.from(document.querySelectorAll(selectors)).filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden").map(element => {
                const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
                return {tag: element.tagName, class: element.getAttribute("class"), role: element.getAttribute("role"), label: element.getAttribute("aria-label"), selected: element.getAttribute("data-selected"), rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, styles: Object.fromEntries(properties.map(key => [key, style[key]]))};
            });
        });
        let png = await page.screenshot({path: join(output, `${name}.png`), animations: "disabled"});
        const result = {name, viewport: page.viewportSize(), sha256: hash(png), measurements, pixelComparison: null};
        if (paired) {
            const originalSheets = await applyCss("original"); await settle();
            const coldState = await fullStyleState();
            const coldOriginal = await page.screenshot({path: join(output, `${name}-original-cold.png`), animations: "disabled"});
            // Same-source control proved one CSS reparse can alter only rounded-outline raster edges.
            // Repeat the exact original CSS once; record the control rather than hide/count-ignore it.
            await applyCss("original"); await settle();
            const originalState = await fullStyleState();
            assert.deepEqual(originalState, coldState, `${name} same-original control full state`);
            const original = await page.screenshot({path: join(output, `${name}-original.png`), animations: "disabled"});
            result.sameOriginalControl = {coldPngSha256: hash(coldOriginal), repeatedPngSha256: hash(original), fullStateEquivalent: true, ...await comparePixels(coldOriginal, original)};
            const currentSheets = await applyCss("current"); await settle();
            const currentState = await fullStyleState();
            assert.deepEqual(currentState, originalState, `${name} same-page every computed property and geometry`);
            png = await page.screenshot({path: join(output, `${name}.png`), animations: "disabled"});
            result.sha256 = hash(png);
            result.samePageComparison = {originalSheets, currentSheets, originalPngSha256: hash(original), currentPngSha256: hash(png), originalStyleAndGeometrySha256: hash(JSON.stringify(originalState)), currentStyleAndGeometrySha256: hash(JSON.stringify(currentState)), elements: currentState.length, computedPropertiesPerElement: Object.keys(currentState[0].styles).length, everyPropertyAndGeometryEquivalent: true, pseudoElementsAttributesSvgValuesTextFocusHoverEquivalent: true};
            result.pixelComparison = await comparePixels(original, png);
            report.captures.push(result); await persist();
            assert.equal(result.pixelComparison.differentPixels, 0, `${name} same-page exact decoded pixel equivalence`);
        }
        if (process.env.E03_REPEAT_CAPTURE === name) {
            result.renderState = await page.evaluate(() => ({active: document.activeElement?.outerHTML, hover: Array.from(document.querySelectorAll(":hover")).map(x => x.className), clips: Array.from(document.querySelectorAll(".at-clip")).map(x => ({selected: x.dataset.selected, outline: getComputedStyle(x).outline, outlineOffset: getComputedStyle(x).outlineOffset, rect: x.getBoundingClientRect().toJSON()})), media: Array.from(document.querySelectorAll("audio")).map(x => ({paused: x.paused, time: x.currentTime, ready: x.readyState})), waveform: document.querySelector(".at-waveform path")?.getAttribute("d")}));
            result.repeatHashes = [];
            for (let i = 0; i < 3; i++) {await settle(); const bytes = await page.screenshot({path: join(output, `${name}-repeat-${i}.png`), animations: "disabled"}); result.repeatHashes.push(hash(bytes));}
        }
        if (process.env.E03_COMPARE) {
            const before = JSON.parse(await readFile(join(process.env.E03_COMPARE, "observations.json"), "utf8")).captures.find(x => x.name === name);
            assert.ok(before, `missing baseline ${name}`); assert.deepEqual(measurements, before.measurements, `${name} computed style and geometry`);
            const original = await readFile(join(process.env.E03_COMPARE, `${name}.png`));
            result.pixelComparison = await comparePixels(original, png);
            report.captures.push(result); await persist();
            assert.equal(result.pixelComparison.differentPixels, 0, `${name} decoded pixel equivalence`);
        } else if (!paired) report.captures.push(result);
        assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.documents, [url]); await persist();
    };
    const audio = async width => {
        await page.evaluate(() => window.e03.show("music")); await page.locator(".mw-root").waitFor();
        await page.setViewportSize({width, height: 900});
        await page.evaluate(() => window.e03.show("audio")); await page.locator(".as-script-input").first().waitFor();
    };
    for (const width of (diagnostic ? (diagnosticPortal ? [1440] : [800]) : [1440, 1099, 800, 799, 390])) {
        await audio(width); await capture(`audio-${width}-script`);
        const chapterButton = page.getByRole("button", {name: "第一章 · 海边来信", exact: true});
        if (width === 390) {await chapterButton.focus(); await page.keyboard.press("Enter"); report.interactions.push({name: "390px chapter portal", method: "native keyboard Enter", limit: "baseline long chapter title overlaps toolbar actions; preserved CSS and used accessible keyboard activation"});} else await chapterButton.click();
        await page.locator(".as-chapter-menu").waitFor(); await capture(`audio-${width}-chapter-portal`); await page.keyboard.press("Escape");
        await page.getByRole("button", {name: "段落 1 选择说话人和音色", exact: true}).click();
        await page.locator(".as-role-popover").waitFor(); await capture(`audio-${width}-role-portal`); await page.keyboard.press("Escape");
        await page.getByRole("button", {name: "配音", exact: true}).click();
        await page.locator(".as-inspector-content").waitFor(); await capture(`audio-${width}-voice-inspector`);
        const inspector = page.locator(".as-inspector-content");
        const select = inspector.locator(".aw-select").first(); await select.click(); await page.getByRole("listbox").waitFor(); await capture(`audio-${width}-select-portal`);
        if (diagnosticPortal) {
            report.portalControl = {snapshots: [], comparisons: []};
            let originalState, previous, previousVariant;
            for (const variant of ["original", "original", "original", "original", "current", "original", "original", "current"]) {
                const sheets = await applyCss(variant); await settle(); const state = await fullStyleState();
                if (!originalState) originalState = state; else assert.deepEqual(state, originalState, "portal full properties, pseudo-elements, attributes/SVG, focus, hover, values and geometry");
                const bytes = await page.screenshot({path: join(output, `portal-control-${report.portalControl.snapshots.length}-${variant}.png`), animations: "disabled"});
                report.portalControl.snapshots.push({variant, sheets, sha256: hash(bytes), styleAndStateSha256: hash(JSON.stringify(state))});
                if (previous) report.portalControl.comparisons.push({before: previousVariant, after: variant, ...await comparePixels(previous, bytes)});
                previous = bytes; previousVariant = variant;
            }
            await persist(); break;
        }
        await page.keyboard.press("Escape");
        await inspector.getByRole("button", {name: "素材", exact: true}).click(); await capture(`audio-${width}-sources`);
        await inspector.getByRole("button", {name: "成品", exact: true}).click(); await capture(`audio-${width}-exports`);
        if (width < 1100) await page.keyboard.press("Escape"); else await page.getByRole("button", {name: "收起声音工作区", exact: true}).click();
        await page.getByRole("button", {name: "音色", exact: true}).click(); await page.getByRole("dialog").waitFor(); await capture(`audio-${width}-voices`);
        await page.getByRole("button", {name: "编辑", exact: true}).click(); await page.getByRole("textbox", {name: "音色名称", exact: true}).waitFor(); await capture(`audio-${width}-voice-editor`); await page.keyboard.press("Escape");
        await page.locator(".as-toolbar-actions").getByRole("button", {name: "添加声音", exact: true}).click(); await page.getByRole("menu").waitFor(); await capture(`audio-${width}-source-menu`);
        await page.getByRole("menuitem", {name: "录制配音", exact: true}).click(); await page.locator(".aw-recorder").waitFor(); await capture(`audio-${width}-recorder-idle`); await page.keyboard.press("Escape");
        await page.locator(".as-toolbar-actions").getByRole("button", {name: "添加声音", exact: true}).click(); await page.getByRole("menuitem", {name: "从素材库选择", exact: true}).click();
        await page.locator(".aw-source-list .aw-source").waitFor(); await capture(`audio-${width}-source-library`); await page.keyboard.press("Escape");
        if (width <= 799) await page.getByRole("button", {name: "剪辑", exact: true}).click(); await capture(`audio-${width}-timeline`);
        assert.ok(await page.locator(".at-clip").count(), "actual seeded clip rendered");
        if (diagnostic) {
            await page.waitForFunction(() => Boolean(document.querySelector(".at-waveform path")?.getAttribute("d")));
            const nodes = await page.evaluate(paths => paths.map(path => {const element = Array.from(document.querySelectorAll("style[data-vite-dev-id]")).find(x => x.dataset.viteDevId.endsWith(path)); if (!element) throw new Error(`Missing actual stylesheet node ${path}`); return {path, id: element.dataset.viteDevId, initial: element.textContent};}), provenance.files.map(x => x.sourcePath));
            const styleState = () => page.evaluate(() => Array.from(document.querySelectorAll(".as-workspace, .as-workspace *")).map(element => {const style = getComputedStyle(element);return {class: element.getAttribute("class"), tag: element.tagName, rect: element.getBoundingClientRect().toJSON(), styles: Object.fromEntries(Array.from(style).map(key => [key, style.getPropertyValue(key)]))};}));
            const initialState = await styleState();
            report.counterfactual = {nodes: nodes.map(x => ({path: x.path, id: x.id, initialSha256: hash(x.initial)})), sequences: [], propertiesPerElement: Object.keys(initialState[0].styles).length};
            for (const variant of ["original", "current", "original", "current"]) {
                const texts = await Promise.all(provenance.files.map(async file => ({path: file.sourcePath, text: await readFile(variant === "original" ? file.snapshotPath : file.sourcePath, "utf8")})));
                await page.evaluate(texts => {for (const item of texts) {const node = Array.from(document.querySelectorAll("style[data-vite-dev-id]")).find(x => x.dataset.viteDevId.endsWith(item.path)); node.textContent = item.text;}}, texts);
                await settle(); const state = await styleState(); assert.deepEqual(state, initialState, `${variant}: every computed property and geometry`);
                const bytes = await page.screenshot({path: join(output, `counterfactual-${report.counterfactual.sequences.length}-${variant}.png`), animations: "disabled"});
                report.counterfactual.sequences.push({variant, stylesheets: texts.map(x => ({path: x.path, sha256: hash(x.text)})), screenshotSha256: hash(bytes), everyComputedPropertyAndGeometryEquivalent: true});
            }
            assert.equal(new Set(report.counterfactual.sequences.map(x => x.screenshotSha256)).size, 1, "same-page original/current swaps are pixel-identical PNGs");
            report.counterfactual.outcome = "pass: four CSS swaps, every computed style and PNG identical";
        }
    }
    for (const width of (diagnostic ? [] : [1440, 1280, 1279, 1000, 800, 760, 390])) {
        await page.evaluate(() => window.e03.show("audio")); await page.locator(".as-workspace").waitFor();
        await page.setViewportSize({width, height: 900}); await page.evaluate(() => window.e03.show("music")); await page.locator(".mw-root").waitFor();
        await capture(`music-${width}-compose`);
        await page.getByRole("combobox", {name: "创作草稿", exact: true}).click(); await page.getByRole("listbox").waitFor(); await capture(`music-${width}-draft-portal`);
        await page.getByRole("option").filter({hasText: "海风序曲"}).click(); await capture(`music-${width}-suno-compose`);
        if (width <= 760) await page.getByRole("tab", {name: "作品 2", exact: true}).click();
        await capture(`music-${width}-library`);
        await page.getByRole("button", {name: "查看 海风序曲 详情", exact: true}).click();
        await page.locator(".mw-detail-content").waitFor(); await capture(`music-${width}-details`);
        await page.getByText("使用这首音乐", {exact: true}).click(); await page.getByRole("combobox", {name: "目标音频项目", exact: true}).click();
        await page.getByRole("listbox").waitFor(); await capture(`music-${width}-target-select-portal`); await page.keyboard.press("Escape");
        if (width < 1280) await page.keyboard.press("Escape"); else await page.getByRole("button", {name: "关闭作品详情", exact: true}).click();
        await page.getByRole("button", {name: "播放 海风序曲", exact: true}).click();
        await page.locator(".aw-player audio").waitFor({state: "attached"}); await page.waitForFunction(() => document.querySelector(".aw-player audio")?.readyState >= 2);
        await capture(`music-${width}-player`);
    }
    report.interactions.push({outcome: "pass", actualPages: ["AudioWorkspacePage", "MusicWorkspacePage"], indexedDB: await page.evaluate(async () => ({projects: await window.e03.db.projects.count(), takes: await window.e03.db.audioTakes.count(), clips: await window.e03.db.audioClips.count(), works: await window.e03.db.musicWorks.count(), jobs: await window.e03.db.audioGenerationJobs.count()})), permissionsRequested: "none; recorder idle only"});
    assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.documents, [url]);
    console.log(`E03 ${mode}: ${report.captures.length} captures passed; ${output}`);
} catch (error) {
    report.failure = {message: error.message, stack: error.stack};
    if (page) {await page.screenshot({path: join(output, "failure.png")}).catch(() => {}); await writeFile(join(output, "failure-dom.txt"), await page.locator("body").innerText().catch(() => ""));}
    throw error;
} finally {
    const sourceChangesDuringRun = [];
    for (const [path, digest] of Object.entries(sourceHashes)) if (hash(await readFile(path)) !== digest) sourceChangesDuringRun.push(path);
    report.sourceChangesDuringRun = sourceChangesDuringRun;
    await persist(); await browser?.close(); await server.close(); await rm(cache, {recursive: true, force: true});
    assert.deepEqual(sourceChangesDuringRun, [], "source must remain frozen during native run");
}
