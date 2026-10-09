import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = "tests/fixtures/e07-draft-rebase";
const variant = process.argv[2] ?? "current";
assert(["current", "regression"].includes(variant), "variant must be current or regression");
const output = process.env.E07_DRAFT_REBASE_OUTPUT_DIR ?? await mkdtemp(path.join(tmpdir(), "e07-draft-rebase-evidence-"));
await mkdir(output, {recursive: true});
const digest = data => createHash("sha256").update(data).digest("hex");
const relativeInputs = [
    "src/lib/debouncedDraft.ts", "src/components/drafts/TextDraftField.tsx", "src/components/ui/draft-status.tsx",
    "src/db/projects.ts", "src/db/database.ts", `${fixture}/harness.tsx`, `${fixture}/index.html`,
    `${fixture}/debouncedDraft-before.ts`, `${fixture}/provenance.json`, "scripts/e07-draft-rebase-browser.mjs",
];
const inputsBefore = Object.fromEntries(await Promise.all(relativeInputs.map(async file => [file, digest(await readFile(path.join(root, file)))])));
const provenance = JSON.parse(await readFile(path.join(root, fixture, "provenance.json"), "utf8"));
const original = await readFile(path.join(root, fixture, "debouncedDraft-before.ts"), "utf8");
assert.equal(digest(original), provenance.sha256, "permanent regression snapshot provenance");
const {chromium} = await import(process.env.E07_PLAYWRIGHT_PATH ?? "playwright");
const cases = [];

for (const shape of ["primitive", "memo"]) {
    const directory = path.join(output, shape);
    await mkdir(directory, {recursive: true});
    const loaded = new Map(), delivered = new Map(), loadedBodies = new Map();
    const errors = [], external = [], documents = [], preflight = [];
    const pending = new Map();
    const cacheDir = await mkdtemp(path.join(tmpdir(), "e07-draft-rebase-vite-"));
    const capture = {name: "e07-draft-rebase-source-proof", enforce: "pre", transform(source, id) {
        const file = path.relative(root, id.split("?")[0]);
        if (file.startsWith("../") || file.startsWith("node_modules/") || !/\.(tsx?|html)$/.test(file)) return source;
        loaded.set(file, digest(source));
        loadedBodies.set(file, source);
        const body = variant === "regression" && file === "src/lib/debouncedDraft.ts" ? original : source;
        delivered.set(file, digest(body));
        return body;
    }};
    const server = await createServer({configFile: false, root, cacheDir, plugins: [capture, react()],
        resolve: {alias: {"@": path.join(root, "src")}},
        optimizeDeps: {holdUntilCrawlEnd: false, entries: [path.join(root, fixture, "index.html")]},
        server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**"]}}});
    let browser, page;
    const observation = {shape, variant};
    const contractErrors = [];
    function check(name, run) {
        try {run();} catch (error) {contractErrors.push({name, message: error.message});}
    }
    async function stage(name, run) {
        const start = Date.now();
        await run();
        const step = {name, milliseconds: Date.now() - start};
        preflight.push(step);
        console.log(JSON.stringify({shape, variant, preflight: step}));
    }
    try {
        await stage("server-listen", () => server.listen());
        const optimizer = server.environments.client.depsOptimizer;
        const processing = async () => {
            await optimizer?.scanProcessing;
            await Promise.all(Object.values(optimizer?.metadata.discovered ?? {}).map(info => info.processing));
        };
        await stage("initial-dependency-processing", processing);
        await stage("actual-fixture-transform", async () => {
            assert(await server.transformRequest(`/${fixture}/harness.tsx`), "fixture transform must return source");
        });
        await stage("static-request-idle", () => server.waitForRequestsIdle());
        await stage("post-transform-dependency-processing", processing);
        browser = await chromium.launch({headless: true,
            ...(process.env.E07_CHROMIUM_PATH ? {executablePath: process.env.E07_CHROMIUM_PATH} : {})});
        page = await browser.newPage();
        page.setDefaultTimeout(10000);
        page.on("pageerror", error => errors.push(error.message));
        page.on("request", request => {
            pending.set(request.url(), {url: request.url(), resourceType: request.resourceType()});
            if (request.resourceType() === "document" && request.frame() === page.mainFrame()) documents.push(request.url());
        });
        page.on("requestfinished", request => pending.delete(request.url()));
        page.on("requestfailed", request => pending.delete(request.url()));
        const origin = server.resolvedUrls.local[0];
        const url = `${origin}${fixture}/index.html?shape=${shape}`;
        await page.route("**/*", route => {
            const requested = new URL(route.request().url());
            if (requested.origin === new URL(origin).origin) return route.continue();
            external.push(requested.href);
            return route.abort();
        });
        await page.goto(url);
        const input = page.getByRole("textbox", {name: "Draft name"});
        await input.fill("Local edit");
        await page.waitForFunction(() => window.e07DraftRebase.writes === 1);
        await page.evaluate(async () => {
            const host = window.e07DraftRebase;
            await host.db.projects.update(host.project.id, {name: "External newest"});
        });
        await page.waitForFunction(() => window.e07DraftRebase.observed === "External newest");
        observation.pending = {draft: await input.inputValue(), status: await page.locator("[data-editor]").getByRole("status").innerText()};
        check("pending-draft-retained", () => assert.deepEqual(observation.pending, {draft: "Local edit", status: "保存中…"}));
        const identityBeforeRelease = await page.evaluate(() => window.e07DraftRebase.memoIdentityChanges);
        await page.evaluate(() => window.e07DraftRebase.release());
        await page.waitForFunction(() => window.e07DraftRebase.writerFinished && document.querySelector('[role="status"]')?.textContent === "已保存");
        // Let actual React commit effects, without substituting its scheduling.
        const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await frame();
        observation.settled = {draft: await input.inputValue(), db: await page.locator("[data-db]").innerText(),
            status: await page.locator("[data-editor]").getByRole("status").innerText()};
        for (let index = 1; index <= 3; index++) {
            await page.evaluate(() => window.e07DraftRebase.rerender());
            await page.waitForFunction(expected => document.querySelector("[data-render]")?.textContent === String(expected), index);
        }
        await frame();
        observation.afterUnrelated = {draft: await input.inputValue(), db: await page.locator("[data-db]").innerText(),
            status: await page.locator("[data-editor]").getByRole("status").innerText()};
        observation.host = await page.evaluate(() => {
            const h = window.e07DraftRebase;
            return {writes: h.writes, writerFinished: h.writerFinished, initialKind: h.initialKind,
                memoIdentityChanges: h.memoIdentityChanges, memoRendersWithSameIdentity: h.memoRendersWithSameIdentity,
                renders: h.renders, parentRenders: h.parentRenders, shape: h.shape};
        });
        const latest = {draft: "External newest", db: "External newest", status: "已保存"};
        check("settled-latest-external", () => assert.deepEqual(observation.settled, latest));
        check("unrelated-render-keeps-latest-external", () => assert.deepEqual(observation.afterUnrelated, latest));
        check("one-durable-write", () => assert.equal(observation.host.writes, 1));
        check("actual-initial-value-domain", () => assert.equal(observation.host.initialKind, shape === "memo" ? "object" : "string"));
        if (shape === "memo") {
            check("memo-identity-stable-after-external-update", () => assert.equal(observation.host.memoIdentityChanges, identityBeforeRelease));
            check("memo-reused-across-actual-renders", () => assert(observation.host.memoRendersWithSameIdentity >= 3));
            check("guarded-rebase-render-bounded", () => assert(observation.host.renders < 30));
        }
        check("no-page-error", () => assert.deepEqual(errors, []));
        check("offline-only", () => assert.deepEqual(external, []));
        check("one-main-document", () => assert.deepEqual(documents, [url]));
        check("actual-current-source-loaded", () => assert.equal(loaded.get("src/lib/debouncedDraft.ts"), inputsBefore["src/lib/debouncedDraft.ts"]));
        check("actual-delivered-source", () => assert.equal(delivered.get("src/lib/debouncedDraft.ts"), variant === "regression" ? provenance.sha256 : inputsBefore["src/lib/debouncedDraft.ts"]));
        await page.screenshot({path: path.join(directory, "after.png")});
        cases.push({shape, variant, status: contractErrors.length ? "FAIL" : "PASS", observation, contractErrors,
            errors, external, documents, preflight});
    } catch (error) {
        cases.push({shape, variant, status: "SETUP_OR_BROWSER_FAILURE", error: error.stack, observation,
            contractErrors, errors, external, documents, preflight, pendingRequests: [...pending.values()]});
        await page?.screenshot({path: path.join(directory, "failure.png")}).catch(() => {});
    } finally {
        for (const [file, body] of loadedBodies) {
            const target = path.join(directory, "loaded-sources", file);
            await mkdir(path.dirname(target), {recursive: true});
            await writeFile(target, body);
        }
        if (variant === "regression") await writeFile(path.join(directory, "delivered-debouncedDraft.ts"), original);
        const afterLoaded = Object.fromEntries(await Promise.all([...loaded.keys()].map(async file =>
            [file, digest(await readFile(path.join(root, file)))])));
        const loadedUnchanged = [...loaded].every(([file, hash]) => afterLoaded[file] === hash);
        if (!loadedUnchanged) {
            const result = cases.at(-1);
            result.status = "SOURCE_CHANGED";
            result.loadedSourceDrift = [...loaded].filter(([file, hash]) => afterLoaded[file] !== hash).map(([file]) => file);
        }
        await writeFile(path.join(directory, "source-identity.json"), JSON.stringify({loaded: Object.fromEntries(loaded),
            delivered: Object.fromEntries(delivered), afterLoaded, loadedUnchanged}, null, 2));
        await browser?.close();
        await server.close();
        await rm(cacheDir, {recursive: true, force: true});
    }
}
const inputsAfter = Object.fromEntries(await Promise.all(relativeInputs.map(async file => [file, digest(await readFile(path.join(root, file)))])));
const unchanged = JSON.stringify(inputsBefore) === JSON.stringify(inputsAfter);
const status = unchanged && cases.every(item => item.status === "PASS") ? "PASS" : "FAIL";
await writeFile(path.join(output, "report.json"), JSON.stringify({status, variant, cases, inputsBefore, inputsAfter, unchanged,
    provenance, limits: ["Actual ReactDOM/TextDraftField/useDebouncedDraft/current project writer and native IndexedDB. Only writer completion is held after its durable rename.",
        "Regression mode delivers the exact permanent pre-fix source at its actual module path; imports remain shared current source.",
        "Two animation frames bound the post-settlement observation; three explicit parent renders retain the same primitive/memo external value. No universal scheduling/device/latency proof.",
        "Fresh isolated Vite cache, static-import preflight and one main document per shape; browser timeout remains10000ms."]}, null, 2) + "\n");
console.log(JSON.stringify({status, variant, shapes: cases.map(item => ({shape: item.shape, status: item.status})), output}));
process.exitCode = status === "PASS" ? 0 : 1;
