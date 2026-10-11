import assert from "node:assert/strict";
import {readFile, writeFile, mkdtemp, rm} from "node:fs/promises";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "../../../../../node_modules/vite/dist/node/index.js";
import react from "../../../../../node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "../../../../../node_modules/@tailwindcss/vite/dist/index.mjs";
import {prepareNativeFixture} from "../../../../../scripts/native-fixture-ready.mjs";

const directory = fileURLToPath(new URL("./", import.meta.url));
const root = path.resolve(directory, "../../../../..");
const {chromium} = await import("/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
const sourcePaths = ["src/lib/useManualDraftGuard.tsx", "src/components/story/StoryPage.tsx", "src/lib/debouncedDraft.ts", "src/lib/useTextDraftRetention.ts", "src/components/drafts/TextDraftField.tsx", "src/components/ui/alert-dialog.tsx", "src/components/ui/button.tsx"];
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, createHash("sha256").update(await readFile(path.join(root, file))).digest("hex")])));
const before = await hashes();
const cache = await mkdtemp(path.join(tmpdir(), "departure-reactdom-"));
const moduleUrl = "/.trellis/tasks/10-11-shared-storage-sqlite/research/departure-reactdom-01/harness.tsx";
const gate = {name: "departure-controlled-save", enforce: "pre", transform(source, id) {
    if (!id.endsWith("/src/db/episodes.ts")) return;
    return source.replace("export async function patchStoryBeat(", "async function _departure_patchStoryBeat(") + `\nexport async function patchStoryBeat(...args: Parameters<typeof _departure_patchStoryBeat>) {await (window as any).departure?.wait(); return _departure_patchStoryBeat(...args);}\n`;
}};
const server = await createServer({root, configFile: false, cacheDir: cache, plugins: [gate, react(), tailwindcss()], optimizeDeps: {holdUntilCrawlEnd: false, entries: [path.join(directory, "index.html")]}, resolve: {alias: {"@": path.join(root, "src")}}, server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**"]}}});
const report = {status: "running", engine: "installed Chromium headless / real ReactDOM + Radix + TanStack hash history + current StoryPage + real disposable IndexedDB", controlledSeam: "hold actual patchStoryBeat before real command; no guard/dialog/router mocks", cases: [], pageErrors: [], sourceBefore: before};
let browser;
try {
    await server.listen(); await prepareNativeFixture(server, moduleUrl);
    browser = await chromium.launch({headless: true, executablePath: "/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    page.setDefaultTimeout(10000); page.on("pageerror", error => report.pageErrors.push(error.message));
    await page.goto(server.resolvedUrls.local[0] + ".trellis/tasks/10-11-shared-storage-sqlite/research/departure-reactdom-01/");
    await page.getByRole("button", {name: "加一场"}).click();
    const title = page.getByLabel("场次标题"), content = page.getByLabel("场次内容"), time = page.getByLabel("时段");
    await title.waitFor();
    const alert = page.getByRole("alertdialog");
    await page.evaluate(() => window.departure.hold());
    await title.fill("Exact retained scene title"); await content.fill("Exact retained scene body"); await time.fill("Night");
    await page.getByRole("link", {name: "World", exact: true}).click();
    await alert.getByRole("heading", {name: "正在处理修改"}).waitFor();
    assert.equal(await alert.getByRole("button", {name: "放弃并离开"}).count(), 0);
    await page.evaluate(() => window.departure.release());
    await alert.getByRole("heading", {name: "保留未保存的修改？"}).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("[data-text-draft]")].every(node => node.textContent.includes("已保存")));
    const beforeCancel = await page.evaluate(async () => ({location: window.departure.location(), episode: await window.departure.db.episodes.get(window.departure.episode.id), alerts: document.querySelectorAll("[role=alertdialog]").length}));
    await alert.getByRole("button", {name: "继续编辑"}).click(); await alert.waitFor({state: "hidden"});
    assert.equal(await page.evaluate(() => window.departure.location()), "/story");
    assert.equal(await title.inputValue(), "Exact retained scene title");
    report.cases.push({name: "three pending beat fields settle -> actual Cancel closes resolver and retains saved scene", outcome: "pass", beforeCancel});
    await page.getByRole("link", {name: "World", exact: true}).click();
    await page.getByText("World page", {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => window.departure.location()), "/world");
    report.cases.push({name: "fresh navigation after canceled resolver succeeds", outcome: "pass"});
    await page.getByRole("link", {name: "Story", exact: true}).click(); await title.waitFor();
    for (const action of ["discard", "keyboard"]) {
        await page.evaluate(() => window.departure.hold()); await content.fill(`Retained ${action}`);
        await page.getByRole("link", {name: "World", exact: true}).click();
        await alert.getByRole("heading", {name: "正在处理修改"}).waitFor();
        await page.evaluate(() => window.departure.release()); await alert.getByRole("heading", {name: "保留未保存的修改？"}).waitFor();
        if (action === "discard") {
            await alert.getByRole("button", {name: "放弃并离开"}).click(); await page.getByText("World page", {exact: true}).waitFor();
            await page.getByRole("link", {name: "Story", exact: true}).click(); await title.waitFor();
        } else {
            await alert.getByRole("button", {name: "继续编辑"}).focus(); await page.keyboard.press("Enter"); await alert.waitFor({state: "hidden"});
            assert.equal(await page.evaluate(() => window.departure.location()), "/story");
        }
        report.cases.push({name: `settled pending route resolver accepts ${action}`, outcome: "pass"});
    }
    report.events = await page.evaluate(() => window.departure.events);
    await page.screenshot({path: path.join(directory, "after.png"), fullPage: true});
    assert.deepEqual(report.pageErrors, []);
    report.sourceAfter = await hashes(); assert.deepEqual(report.sourceAfter, before);
    report.status = "PASS";
} catch (error) {report.status = "FAIL"; report.failure = {name: error.name, message: error.message, stack: error.stack}; process.exitCode = 1;}
finally {await browser?.close(); await server.close(); await rm(cache, {recursive: true, force: true}); await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({status: report.status, cases: report.cases, failure: report.failure}));}
