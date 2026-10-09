import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile, writeFile, mkdir, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, relative} from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {createServer} from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = process.env.E04_MEMORY_BASELINE === "1";
const mode = baseline ? "before" : "after";
const output = process.env.E04_MEMORY_OUTPUT ?? await mkdtemp(join(tmpdir(), `e04-memory-${mode}-`));
await mkdir(output, {recursive: true});
const cacheDir = await mkdtemp(join(tmpdir(), "e04-memory-vite-cache-"));
const snapshotPath = join(root, "tests/fixtures/sourceSnapshots/e04-memory/projectMemories.ts");
const provenancePath = join(root, "tests/fixtures/sourceSnapshots/e04-memory/provenance.json");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const original = await readFile(snapshotPath);
assert.equal(hash(original), provenance.sha256, "Exact immutable original bytes");
const producerPaths = ["src/db/projectMemories.ts", "scripts/e04-memory-browser-regression.mjs", "tests/e04MemoryTransactions.test.ts", "tests/fixtures/e04-memory/tsconfig.json", "tests/fixtures/e04-memory/main.ts", "tests/fixtures/e04-memory/index.html", "tests/fixtures/sourceSnapshots/e04-memory/projectMemories.ts", "tests/fixtures/sourceSnapshots/e04-memory/provenance.json"];
const producerHashes = Object.fromEntries(await Promise.all(producerPaths.map(async path => [path, hash(await readFile(join(root, path)))])));
const sourceHashes = {};
const sourceSnapshot = {
  name: "e04-memory-original-comparison", enforce: "pre",
  async transform(source, id) {
    const path = id.split("?")[0];
    if (path.startsWith(join(root, "src/")) && path.endsWith(".ts")) sourceHashes[relative(root, path)] ??= hash(source);
    if (baseline && path === join(root, "src/db/projectMemories.ts")) return original.toString("utf8");
    return source;
  },
};
const server = await createServer({
  root, configFile: false, cacheDir, plugins: [sourceSnapshot],
  optimizeDeps: {entries: [join(root, "tests/fixtures/e04-memory/index.html")]},
  resolve: {alias: {"@": join(root, "src")}},
  server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**"]}},
});
const playwrightPath = process.env.E04_MEMORY_PLAYWRIGHT_PATH ?? "playwright";
const {chromium} = await import(playwrightPath);
const require = createRequire(import.meta.url);
const report = {
  mode, versions: {node: process.version, vite: require("vite/package.json").version, dexie: require("dexie/package.json").version},
  producerHashes, sourceHashes, originalSHA256: provenance.sha256,
  cases: [], errors: [], documents: [],
  limits: ["Actual repository memory commands in isolated Chromium IndexedDB; fixture controls history-write completion using Dexie.waitFor.", "Same-store readwrite transactions serialize across the declared stores; this is not a per-project lock or latency measurement.", "Before blocked-unrelated observation is finite at a checkpoint after five transactions in a separate native database, not a timed speed claim.", "Current dependencies are shared with the immutable original memory module; no live provider calls or full-app UI claim."],
};
let browser, page, url;
const persist = () => writeFile(join(output, "observations.json"), JSON.stringify(report, null, 2) + "\n");
try {
  await server.listen();
  browser = await chromium.launch({headless: true, ...(process.env.E04_MEMORY_CHROMIUM_PATH ? {executablePath: process.env.E04_MEMORY_CHROMIUM_PATH} : {})});
  report.versions.chromium = browser.version();
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("request", request => {if (request.resourceType() === "document" && request.frame() === page.mainFrame()) report.documents.push(request.url());});
  url = server.resolvedUrls.local[0] + "tests/fixtures/e04-memory/";
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.e04Memory));
  const test = async (name, run) => {
    try {
      const evidence = await run();
      assert.deepEqual(report.errors, []);
      assert.deepEqual(report.documents, [url], "Single explicit fixture document");
      report.cases.push({name, outcome: "pass", evidence});
      console.log(`PASS ${mode}: ${name}`);
    } catch (error) {
      report.cases.push({name, outcome: "fail", error: String(error)});
      await page.screenshot({path: join(output, "failure.png")});
      throw error;
    } finally { await persist(); }
  };
  await test("all five actual transaction storeNames", async () => {
    const result = await page.evaluate(() => window.e04Memory.scopes());
    const names = ["createProjectMemory", "updateProjectMemory", "setProjectMemoryStatus", "replaceProjectMemory", "deleteProjectMemory"];
    assert.deepEqual([...new Set(result.observations.map(row => row.command))].sort(), names.sort());
    for (const row of result.observations) {
      assert.equal(row.mode, "readwrite");
      if (baseline) assert.equal(row.storeNames.length, result.totalStores);
      else assert.deepEqual(row.storeNames, ["projectMemories", "projectMemoryVersions", "projects"]);
    }
    return result;
  });
  await test("rollback after actual history and later replacement writes", async () => {
    const result = await page.evaluate(() => window.e04Memory.rollback());
    assert.equal(result.actualHistoryInsertions, 1); assert.equal(result.laterFailures, 2); assert.equal(result.retryRevision, 2);
    return result;
  });
  await test("native ownership, CAS, normalized conflict and disabled duplicate protection", async () => {
    const result = await page.evaluate(() => window.e04Memory.guards());
    assert.equal(result.rejections.length, 3); assert.equal(result.unchangedSnapshots, 2); assert.equal(result.duplicate.status, "disabled");
    return result;
  });
  await test("native same-owner serialization and unrelated-store scheduling", async () => {
    const initial = await page.evaluate(() => window.e04Memory.beginScheduling());
    assert.equal(initial.held, true);
    // A separate native database supplies a request-driven checkpoint with no sleep.
    const probe = await page.evaluate(async () => {
      const open = indexedDB.open("e04-memory-scheduler-probe", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("probe");
      const connection = await new Promise((resolve, reject) => {open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);});
      let completed = 0;
      try {
        for (let i = 0; i < 5; i++) {
          await new Promise((resolve, reject) => {
            const tx = connection.transaction("probe", "readwrite");
            tx.objectStore("probe").put(i, "checkpoint");
            tx.oncomplete = () => {completed++; resolve();}; tx.onabort = () => reject(tx.error);
          });
        }
      } finally { connection.close(); }
      return {completed};
    });
    if (!baseline) await page.waitForFunction(() => window.e04Memory.schedulingState().unrelatedCompleted);
    const held = await page.evaluate(() => window.e04Memory.schedulingState());
    report.schedulingCheckpoint = {probe, held};
    await persist();
    assert.equal(probe.completed, 5); assert.equal(held.held, true); assert.equal(held.released, false); assert.equal(held.secondHistoryWrites, 0);
    assert.equal(held.events.includes("second-cas-rejected"), false, "Second command cannot pass memory lock before first completes");
    assert.equal(held.unrelatedCompleted, !baseline);
    const result = await page.evaluate(async () => {
      try { return {final: await window.e04Memory.finishScheduling()}; }
      catch (error) { return {error: String(error), state: window.e04Memory.schedulingState()}; }
    });
    report.schedulingCompletion = result;
    await persist();
    assert.equal(result.error, undefined, JSON.stringify(result));
    const final = result.final;
    assert.equal(final.completed.firstRevision, 2); assert.equal(final.completed.finalRevision, 2);
    assert.match(final.completed.secondError, /已更新/); assert.deepEqual(final.completed.historyRevisions, [1, 2]);
    assert.equal(final.secondHistoryWrites, 0); assert.equal(final.unrelatedCompleted, true);
    const mediaEvent = final.events.indexOf("unrelated-media-written"), release = final.events.indexOf("release-requested");
    assert.ok(baseline ? mediaEvent > release : mediaEvent < release);
    return {probe, held, final};
  });
  for (const [path, expected] of Object.entries(producerHashes)) assert.equal(hash(await readFile(join(root, path))), expected, `Frozen owned input ${path}`);
  report.dependencyChanges = [];
  for (const [path, observed] of Object.entries(sourceHashes)) {
    const after = hash(await readFile(join(root, path)));
    if (after !== observed) report.dependencyChanges.push({path, observed, after});
  }
  report.ownedInputsUnchanged = true;
  report.freezeScope = "PD06 owned source, tests, fixture, runner and baseline only. Loaded shared dependencies are observations; coordinator validates current integrated closure.";
  console.log(`E04 memory ${mode}: ${report.cases.length} passed; ${output}`);
} finally {
  await persist(); await browser?.close(); await server.close(); await rm(cacheDir, {recursive: true, force: true});
}
