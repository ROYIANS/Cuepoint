import assert from "node:assert/strict";
import {readFile, writeFile, mkdtemp, mkdir, rm, access} from "node:fs/promises";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";

const root = fileURLToPath(new URL("../", import.meta.url)), hash = bytes => createHash("sha256").update(bytes).digest("hex");
const output = process.env.E04_MEDIA_OUTPUT ?? await mkdtemp(join(tmpdir(), "e04-media-native-"));
await mkdir(output, {recursive: true});
try {await access(join(output, "report.json")); throw new Error("Refusing to overwrite an earlier E04 attempt");} catch (error) {if (error.code !== "ENOENT") throw error;}
const ownSources = ["src/db/media.ts", "src/db/assets.ts", "src/db/shots.ts", "src/db/episodes.ts", "src/db/assetReuse.ts", "src/db/cascadeCommands.ts"];
const fixtures = ["tests/e04MediaRetention.test.ts", "scripts/e04-media-browser-regression.mjs", ...["seeds.ts", "instrumentation.ts", "retention.ts", "commands.ts", "receipt.ts", "main.ts", "index.html", "tsconfig.json"].map(name => `tests/fixtures/e04-media/${name}`), ...["src/db/media.ts", "src/db/database.ts", "src/db/productionShared.ts", "provenance.json"].map(name => `tests/fixtures/sourceSnapshots/e04-media/${name}`)];
const owned = [...ownSources, ...fixtures], entry = Object.fromEntries(await Promise.all(owned.map(async path => [path, hash(await readFile(join(root, path)))])));
const provenance = JSON.parse(await readFile(join(root, "tests/fixtures/sourceSnapshots/e04-media/provenance.json"), "utf8"));
for (const file of provenance.files) assert.equal(hash(await readFile(join(root, file.snapshotPath))), file.sha256);
const loaded = new Map();
const capture = {name: "e04-media-actual-source-closure", enforce: "pre", async transform(_code, id) {
    const path = id.split("?")[0];
    if (!path.startsWith(root) || !/\.(ts|tsx|js|json)$/.test(path) || path.includes("/node_modules/")) return;
    const rel = relative(root, path), bytes = await readFile(path), digest = hash(bytes);
    const prior = loaded.get(rel);
    if (prior && prior.sha256 !== digest) prior.reloadHashes.push(digest);
    else if (!prior) loaded.set(rel, {path: rel, sha256: digest, bytes: bytes.length, reloadHashes: []});
}};
const cache = await mkdtemp(join(tmpdir(), "e04-media-vite-cache-"));
const server = await createServer({configFile: false, root, cacheDir: cache, plugins: [capture], optimizeDeps: {entries: [join(root, "tests/fixtures/e04-media/index.html")]}, resolve: {alias: {"@": join(root, "src")}}, server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**"]}}});
const playwrightPath = process.env.E04_MEDIA_PLAYWRIGHT_PATH ?? "playwright";
const {chromium} = await import(playwrightPath);
const report = {schema: 1, startedAt: new Date().toISOString(), status: "running", node: process.version, playwrightPath, executable: process.env.E04_MEDIA_CHROMIUM_PATH ?? "Playwright default", ownership: {ownSources, entry, sourceScope: "Actual Vite-transformed repository module closure captured on first read; own frozen paths asserted; shared/current-root drift reported without claiming all-src stability"}, pageErrors: [], documentRequests: 0, externalRequests: 0};
let browser, page, failure;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.E04_MEDIA_CHROMIUM_PATH ? {executablePath: process.env.E04_MEDIA_CHROMIUM_PATH} : {})});
    report.chromiumVersion = browser.version();
    page = await browser.newPage();
    page.on("pageerror", error => report.pageErrors.push(error.message));
    page.on("request", request => {if (request.resourceType() === "document" && request.frame() === page.mainFrame()) report.documentRequests++;});
    await page.route("**/*", route => {
        if (new URL(route.request().url()).hostname !== "127.0.0.1") {report.externalRequests++; return route.abort();}
        return route.continue();
    });
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/e04-media/");
    await page.waitForFunction(() => !!window.e04Media);
    report.results = await page.evaluate(() => window.e04Media.run());
    assert.equal(report.results.releaseEvent.copies, 3);
    assert.equal(report.results.receipt.rollback, true);
    assert.equal(report.results.scheduling.overlappingWriterSawWholeCommit, true);
    assert.equal(report.externalRequests, 0); assert.deepEqual(report.pageErrors, []); assert.equal(report.documentRequests, 1);
    report.status = "passed";
} catch (error) {failure = error; report.status = "failed"; report.error = error.stack ?? String(error);
    if (page) report.partialResults = await page.evaluate(() => window.e04Media?.progress).catch(() => undefined);}
finally {
    await browser?.close(); await server.close(); await rm(cache, {recursive: true, force: true});
    report.ownership.after = Object.fromEntries(await Promise.all(owned.map(async path => [path, hash(await readFile(join(root, path)))])));
    report.ownership.ownDrift = owned.filter(path => entry[path] !== report.ownership.after[path]);
    report.actualSourceClosure = await Promise.all([...loaded.values()].map(async record => ({...record, afterSHA256: hash(await readFile(join(root, record.path)))})));
    report.sharedClosureDrift = report.actualSourceClosure.filter(record => record.sha256 !== record.afterSHA256 || record.reloadHashes.length);
    report.limits = ["Native Chromium IndexedDB executes actual current repository commands with synthetic local rows/Blob bytes; no provider calls or product UI", "Counts separate full-table retention passes, indexed history reads, cursor rows, candidate reads and owner mutation reads; no inferred latency improvement", "Parallel writers may change non-owned shared dependencies; this runner reports the actual served closure and drift, not whole-src stability. Coordinator must rerun integration on final current root"];
    if (report.ownership.ownDrift.length) {report.status = "failed"; failure ??= new Error("Owned sources changed during native run");}
    report.finishedAt = new Date().toISOString();
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({output: resolve(output), status: report.status, cases: report.results ? Object.fromEntries(Object.entries(report.results).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])) : {}, ownDrift: report.ownership.ownDrift, sharedClosureDrift: report.sharedClosureDrift.map(record => record.path), documentRequests: report.documentRequests, externalRequests: report.externalRequests, error: report.error}));
}
if (failure) throw failure;
