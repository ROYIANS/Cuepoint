import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile, writeFile, mkdir, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, relative} from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {createServer} from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = process.env.E05_BASELINE === "1";
const mode = baseline ? "before" : "after";
const output = process.env.E05_OUTPUT ?? await mkdtemp(join(tmpdir(), `e05-${mode}-`));
await mkdir(output, {recursive: true});
const cacheDir = await mkdtemp(join(tmpdir(), "e05-vite-cache-"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const original = await readFile(join(root, "tests/fixtures/sourceSnapshots/e05/click-spark.tsx"));
const provenance = JSON.parse(await readFile(join(root, "tests/fixtures/sourceSnapshots/e05/provenance.json"), "utf8"));
assert.equal(hash(original), provenance.sha256, "Immutable original bytes");
const paths = ["src/components/ui/click-spark.tsx", "src/lib/utils.ts", "scripts/e05-browser-regression.mjs", "tests/fixtures/e05/index.html", "tests/fixtures/e05/harness.tsx", "tests/fixtures/e05/instrumentation.ts", "tests/fixtures/e05/tsconfig.json", "tests/fixtures/sourceSnapshots/e05/click-spark.tsx", "tests/fixtures/sourceSnapshots/e05/provenance.json", "package.json", "pnpm-lock.yaml", "tsconfig.app.json"];
const producers = Object.fromEntries(await Promise.all(paths.map(async path => {
  const bytes = await readFile(join(root, path));
  await mkdir(join(output, "sources", relative(root, join(root, path)), ".."), {recursive: true});
  await writeFile(join(output, "sources", path), bytes);
  return [path, hash(bytes)];
})));
const sources = {};
const server = await createServer({root, configFile: false, cacheDir,
  plugins: [{name: "e05-exact-original-comparison", enforce: "pre", transform(source, id) {
    const path = id.split("?")[0];
    if (path.startsWith(root) && !path.includes("node_modules") && /\.(tsx?|html)$/.test(path)) sources[relative(root, path)] = hash(source);
    if (baseline && path === join(root, "src/components/ui/click-spark.tsx")) return original.toString("utf8");
    return source;
  }}],
  optimizeDeps: {entries: [join(root, "tests/fixtures/e05/index.html")], include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"]}, resolve: {alias: {"@": join(root, "src")}},
  server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**"]}},
});
const {chromium} = await import(process.env.E05_PLAYWRIGHT_PATH ?? "playwright");
const require = createRequire(import.meta.url);
const report = {mode, producers, sources, originalSHA256: provenance.sha256,
  versions: {node: process.version, vite: require("vite/package.json").version, react: require("react/package.json").version},
  cases: [], documents: [], errors: [], loadedResponses: [],
  limits: ["RAF requests/cancellations forward to native Chromium scheduling; counters select actual ClickSpark request stacks (/src/components/ui/click-spark.tsx), excluding Playwright RAF polling. Executed counters are callback entry counts, with real performance.now and no fake timers.",
    "Visibility is an explicit controlled document.hidden/visibilityState plus visibilitychange seam. This is handler cancellation proof, NOT real OS background-tab throttling. Prior headless/headful capability attempts could not produce document.hidden=true; no new broad probes.",
    "Reduced motion uses page.emulateMedia; resize uses native ResizeObserver. Finite idle observations use 180ms and 140ms windows, not an infinite trace or latency claim.",
    "maxOutstanding is the cumulative whole-fixture maximum for component-owned RAF IDs. Instantaneous same-task pending snapshots verify the current StrictMode/props/unmount lifecycle. Only actual ClickSpark is mounted; fixture supplies minimal geometry/class styling. Pixel evidence is nonzero alpha while drawing and exact zero after clear, with geometric equations checked against actual clock readings; no arbitrary pixel mask/tolerance.",
    "Original component shares current untouched cn utility and installed dependencies. No mutable task imports, external providers, installs, full-product or CI execution claim."]};
let browser;
const responseReads = [];
const persist = () => writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
try {
  await server.listen();
  browser = await chromium.launch({headless: true, executablePath: process.env.E05_CHROMIUM_PATH});
  report.versions.chromium = browser.version();
  const page = await browser.newPage({viewport: {width: 800, height: 600}, reducedMotion: "no-preference"});
  page.on("pageerror", error => report.errors.push(String(error)));
  page.on("response", response => {
    if (!["script", "document", "stylesheet"].includes(response.request().resourceType())) return;
    responseReads.push((async () => {
      const body = await response.body();
      const sha256 = hash(body);
      await mkdir(join(output, "loaded-responses"), {recursive: true});
      await writeFile(join(output, "loaded-responses", sha256), body);
      report.loadedResponses.push({url: response.url(), resourceType: response.request().resourceType(), status: response.status(), bytes: body.length, sha256});
    })());
  });
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) report.documents.push(request.url()); });
  const url = `${server.resolvedUrls.local[0]}tests/fixtures/e05/index.html`;
  await page.goto(url); await page.waitForFunction(() => Boolean(window.e05));
  const read = () => page.evaluate(() => window.e05.read());
  const wait = ms => page.waitForTimeout(ms);
  const click = () => page.evaluate(() => window.e05.click());
  const mount = (options = {}, strict = false) => page.evaluate(({options, strict}) => window.e05.mount(options, strict), {options, strict});
  const unmount = () => page.evaluate(() => window.e05.unmount());
  const idle = async ms => { const a = await read(); await wait(ms); const b = await read(); return {executed: b.executed.length - a.executed.length, outstanding: b.outstanding, from: a.executed.length, to: b.executed.length}; };
  const test = async (name, run) => {
    try {
      const evidence = await run(); assert.deepEqual(report.errors, []); assert.deepEqual(report.documents, [url]);
      report.cases.push({name, outcome: "pass", evidence}); console.log(`PASS ${mode}: ${name}`);
    } catch (error) {
      report.cases.push({name, outcome: "fail", error: String(error), state: await read()});
      await page.screenshot({path: join(output, "failure.png")}); throw error;
    } finally {
  const responseResults = await Promise.allSettled(responseReads);
  report.responseReadFailures = responseResults.filter(row => row.status === "rejected").map(row => String(row.reason));
  if (report.responseReadFailures.length > 0) { report.status = "FAIL"; process.exitCode = 1; }
  await persist(); }
  };
  await test("bounded native idle callback loop before / zero after", async () => {
    await wait(140); const first = await idle(180); const second = await idle(140);
    if (baseline) { assert.ok(first.executed >= 3); assert.ok(second.executed >= 3); assert.equal(first.outstanding.length, 1); }
    else { assert.equal(first.executed, 0); assert.equal(second.executed, 0); assert.deepEqual(second.outstanding, []); }
    return {first, second};
  });
  await test("real child pointer click, default eight radial strokes, native painting and expiration", async () => {
    const initial = await read(); await page.locator("#child").click();
    await page.waitForFunction(() => window.e05.read().paintedPixels > 0);
    const active = await read();
    assert.ok(active.executed.length > initial.executed.length); assert.equal(active.outstanding.length, 1);
    assert.equal(active.childClicks, initial.childClicks + 1); assert.equal(active.parentClicks, initial.parentClicks + 1);
    assert.equal(active.canvas.pointerEvents, "none"); assert.equal(active.canvas.ariaHidden, "true");
    const frame = active.frames.find(row => row.strokes.length === 8); assert.ok(frame);
    const start = active.burstTimes.at(-1); assert.ok(start);
    const x = 140, y = 90;
    for (const [i, stroke] of frame.strokes.entries()) {
      const t = (stroke.now - start) / 400; const eased = t * (2 - t); const angle = 2 * Math.PI * i / 8;
      const expected = [x + eased * 15 * Math.cos(angle), y + eased * 15 * Math.sin(angle), x + (eased * 15 + 10 * (1 - eased)) * Math.cos(angle), y + (eased * 15 + 10 * (1 - eased)) * Math.sin(angle)];
      [ ...stroke.from, ...stroke.to ].forEach((value, j) => assert.ok(Math.abs(value - expected[j]) < 1e-8, `radial coordinate ${i}/${j}`));
      assert.equal(stroke.width, 2); assert.equal(stroke.color, "#ffffff");
    }
    await page.screenshot({path: join(output, "active-default.png")});
    await wait(460); const expired = await read(); assert.equal(expired.paintedPixels, 0);
    const quiet = await idle(180); assert.equal(quiet.executed === 0, !baseline);
    return {activeExecuted: active.executed.length - initial.executed.length, outstanding: active.outstanding, frame, paintedPixels: active.paintedPixels, expiredPixels: expired.paintedPixels, quiet};
  });
  await test("overlapping clicks share one outstanding native frame", async () => {
    await unmount(); await mount({duration: 600, sparkCount: 5});
    const state = await page.evaluate(() => { window.e05.click(140, 90, 3); return window.e05.read(); });
    assert.equal(state.outstanding.length, 1); assert.equal(state.maxOutstanding, 1);
    await page.waitForFunction(() => window.e05.read().frames.some(frame => frame.strokes.length === 15));
    await wait(680); return {outstanding: state.outstanding, maxOutstanding: state.maxOutstanding, quiet: await idle(140)};
  });
  await test("controlled visibility: original continuous loop/accepted clicks versus current cancel/reset/suppression", async () => {
    await unmount(); await mount({duration: 1200}); await click(); await wait(40);
    const {before, hidden} = await page.evaluate(() => {
      const before = window.e05.read(); window.e05.visibility(true);
      return {before, hidden: window.e05.read()};
    });
    assert.ok(before.paintedPixels > 0);
    if (!baseline) { assert.deepEqual(hidden.outstanding, []); assert.equal(hidden.paintedPixels, 0); assert.ok(hidden.cancelled.some(row => before.outstanding.includes(row.id) && row.wasOutstanding)); }
    await click(); const hiddenQuiet = await idle(180); assert.equal(hiddenQuiet.executed === 0, !baseline);
    const hiddenState = await read(); assert.equal(hiddenState.burstTimes.length, before.burstTimes.length + (baseline ? 1 : 0), "original accepts hidden clicks; current suppresses them");
    await page.evaluate(() => window.e05.visibility(false)); const returnedQuiet = await idle(140);
    if (!baseline) { assert.equal(returnedQuiet.executed, 0); assert.equal((await read()).paintedPixels, 0); }
    await click(); await page.waitForFunction(() => window.e05.read().paintedPixels > 0);
    return {seam: "controlled property/event; no OS throttling claim", beforeOutstanding: before.outstanding, hiddenOutstanding: hidden.outstanding, cancellations: hidden.cancelled, hiddenQuiet, returnedQuiet, nextClickPixels: (await read()).paintedPixels};
  });
  await test("native media: original continuous loop versus current cancel/reset; reduced clicks suppressed in both", async () => {
    await unmount(); await mount({duration: 1200}); await click(); await wait(40);
    const before = await read(); await page.emulateMedia({reducedMotion: "reduce"});
    await page.waitForFunction(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    await wait(40); const reduced = await read();
    if (!baseline) { assert.deepEqual(reduced.outstanding, []); assert.equal(reduced.paintedPixels, 0); const event = reduced.mediaEvents.at(-1); assert.equal(event.matches, true); assert.equal(event.before.length, 1); assert.deepEqual(event.after, []);
      assert.ok(event.cancellations.some(row => row.wasOutstanding && event.before.includes(row.id))); }
    await click(); const quiet = await idle(180); assert.equal(quiet.executed === 0, !baseline);
    assert.equal((await read()).burstTimes.length, before.burstTimes.length);
    await page.emulateMedia({reducedMotion: "no-preference"}); await wait(40);
    const returned = await idle(140); if (!baseline) assert.equal(returned.executed, 0);
    await click(); await page.waitForFunction(() => window.e05.read().paintedPixels > 0);
    return {beforeOutstanding: before.outstanding, reducedOutstanding: reduced.outstanding, cancellations: reduced.cancelled.slice(before.cancelled.length), mediaEvents: reduced.mediaEvents, quiet, returned, nextClickPixels: (await read()).paintedPixels};
  });
  await test("all drawing option updates retain live original burst timestamps and current-duration expiry", async () => {
    await unmount(); await mount({duration: 2200}); await click(); await wait(30);
    const initial = await read(); const start = initial.burstTimes.at(-1); const evidence = [];
    let liveOptions = {sparkSize: 10, sparkRadius: 15, extraScale: 1, easing: "ease-out", duration: 2200};
    for (const patch of [{sparkColor: "#ff0000"}, {sparkSize: 20}, {sparkRadius: 30}, {extraScale: 2}, {easing: "linear"}, {easing: "ease-in"}, {easing: "ease-in-out"}, {easing: "ease-out"}, {duration: 3000}]) {
      const {previous, restarted} = await page.evaluate(patch => {
        const previous = window.e05.read(); window.e05.update(patch);
        return {previous, restarted: window.e05.read()};
      }, patch);
      assert.ok(restarted.cancelled.slice(previous.cancelled.length).some(row => row.wasOutstanding && previous.outstanding.includes(row.id)), "option cleanup cancels exact same-task pending ID");
      assert.equal(restarted.outstanding.length, 1);
      await page.waitForFunction(count => window.e05.read().executed.length > count, restarted.executed.length);
      const current = await read(); assert.ok(current.paintedPixels > 0); assert.equal(current.burstTimes.at(-1), start); assert.equal(current.outstanding.length, 1);
      const frame = current.frames.filter(row => row.strokes.length === 8).at(-1); assert.equal(frame.strokes[0].color, "#ff0000");
      liveOptions = {...liveOptions, ...patch};
      const first = frame.strokes[0]; const t = (first.now - start) / liveOptions.duration;
      const eased = liveOptions.easing === "linear" ? t : liveOptions.easing === "ease-in" ? t * t : liveOptions.easing === "ease-in-out" ? (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t) : t * (2 - t);
      const distance = eased * liveOptions.sparkRadius * liveOptions.extraScale;
      assert.ok(Math.abs(first.from[0] - 140 - distance) < 1e-8, "updated radial travel");
      assert.ok(Math.abs(first.to[0] - first.from[0] - liveOptions.sparkSize * (1 - eased)) < 1e-8, "updated shrinking line length");
      assert.equal(first.from[1], 90); assert.equal(first.to[1], 90);
      evidence.push({patch, beforeOutstanding: previous.outstanding, restartedOutstanding: restarted.outstanding, cancellations: restarted.cancelled.slice(previous.cancelled.length), executedDelta: current.executed.length - restarted.executed.length, start, frame});
    }
    await page.evaluate(() => window.e05.update({duration: 1})); await wait(40);
    const expired = await read(); assert.equal(expired.paintedPixels, 0); const quiet = await idle(140); assert.equal(quiet.executed === 0, !baseline);
    return {updates: evidence, expiredPixels: expired.paintedPixels, quiet};
  });
  await test("native resize retains coordinate space and debounced timer is cleaned on unmount", async () => {
    await unmount(); await mount({duration: 600}); await wait(150);
    await page.evaluate(() => window.e05.resize(600, 310)); await wait(160);
    const resized = await read(); assert.equal(resized.canvas.width, 600); assert.equal(resized.canvas.height, 310); assert.ok(resized.resizeCallbacks > 0);
    await page.mouse.click(48 + 140, 48 + 90); await page.waitForFunction(() => window.e05.read().paintedPixels > 0);
    const active = await read(); const frame = active.frames.filter(row => row.strokes.length === 8).at(-1);
    assert.ok(frame.strokes[0].from[0] >= 140 && frame.strokes[0].from[0] < 155); assert.equal(frame.strokes[0].from[1], 90);
    await page.evaluate(() => window.e05.resize(520, 280));
    await page.waitForFunction(() => window.e05.read().timers.length > 0);
    const pending = await read(); await unmount(); const cleaned = await read();
    assert.deepEqual(cleaned.timers, []); assert.deepEqual(cleaned.outstanding, []); assert.equal(cleaned.observers, 0);
    assert.equal(cleaned.visibilityListeners, 0); assert.equal(cleaned.mediaListeners, 0);
    const quiet = await idle(180); assert.equal(quiet.executed, 0); assert.equal((await read()).timeoutCallbacks, cleaned.timeoutCallbacks);
    return {resized: resized.canvas, frame, pendingTimers: pending.timers, cleaned, quiet};
  });
  await test("StrictMode setup replay leaves one owned lifecycle; active unmount cleans it", async () => {
    await mount({duration: 1200}, true); await wait(140);
    const mounted = await read(); assert.equal(mounted.observers, 1); assert.equal(mounted.visibilityListeners, baseline ? 0 : 1); assert.equal(mounted.mediaListeners, baseline ? 0 : 1);
    const initialQuiet = await idle(140); if (!baseline) assert.equal(initialQuiet.executed, 0);
    await click(); await wait(40);
    const {active, cleaned} = await page.evaluate(() => {
      const active = window.e05.read(); window.e05.unmount(); return {active, cleaned: window.e05.read()};
    });
    assert.equal(active.outstanding.length, 1); assert.equal(active.maxOutstanding, 1);
    assert.ok(cleaned.cancelled.slice(active.cancelled.length).some(row => row.wasOutstanding && active.outstanding.includes(row.id)), "unmount cancels same-task pending ID"); assert.deepEqual(cleaned.outstanding, []); assert.equal(cleaned.observers, 0); assert.equal(cleaned.visibilityListeners, 0); assert.equal(cleaned.mediaListeners, 0); assert.deepEqual(cleaned.timers, []);
    const quiet = await idle(180); assert.equal(quiet.executed, 0);
    assert.equal((await read()).frameCount, cleaned.frameCount);
    return {mounted: {observers: mounted.observers, visibilityListeners: mounted.visibilityListeners, mediaListeners: mounted.mediaListeners}, initialQuiet, activeOutstanding: active.outstanding, cleanedOutstanding: cleaned.outstanding, cancellations: cleaned.cancelled.slice(active.cancelled.length), quiet};
  });
  await test("disabled/zero-count: original idle loop versus current zero work; enabling next click works", async () => {
    await page.emulateMedia({reducedMotion: "reduce"}); await mount(); await click();
    const disabled = await idle(140); assert.equal(disabled.executed === 0, !baseline);
    await page.emulateMedia({reducedMotion: "no-preference"}); await wait(40);
    await page.evaluate(() => window.e05.update({sparkCount: 0})); await click();
    const zeroCount = await idle(140); assert.equal(zeroCount.executed === 0, !baseline);
    await page.evaluate(() => window.e05.update({sparkCount: 8})); await click();
    await page.waitForFunction(() => window.e05.read().paintedPixels > 0);
    await page.screenshot({path: join(output, "active-final.png")}); await unmount();
    return {disabled, zeroCount, unmountedQuiet: await idle(140)};
  });
  for (const [path, sha] of Object.entries(producers)) assert.equal(hash(await readFile(join(root, path))), sha, `Producer changed during run: ${path}`);
  await Promise.all(responseReads);
  assert.ok(report.loadedResponses.length > 0);
  report.status = "PASS";
} catch (error) { report.status = "FAIL"; report.failure = String(error); process.exitCode = 1; }
finally {
  const responseResults = await Promise.allSettled(responseReads);
  report.responseReadFailures = responseResults.filter(row => row.status === "rejected").map(row => String(row.reason));
  if (report.responseReadFailures.length > 0) { report.status = "FAIL"; process.exitCode = 1; }
  await persist(); await browser?.close(); await server.close(); await rm(cacheDir, {recursive: true, force: true}); }
console.log(`${report.status}: ${output}`);
