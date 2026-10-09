import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputDir = process.env.E04_LIBRARY_OUTPUT_DIR ?? await mkdtemp(join(tmpdir(), "e04-library-evidence-"));
await mkdir(outputDir, {recursive: true});
const digest = text => createHash("sha256").update(text).digest("hex");
const ownFiles = ["src/components/studio/ProjectGalleryPage.tsx", "src/components/studio/AssetLibraryPages.tsx", "src/lib/studioLibraryQueries.ts", "tests/e04LibraryQueries.test.ts", "tests/fixtures/e04-library/harness.tsx", "tests/fixtures/e04-library/index.html", "tests/fixtures/e04-library/tsconfig.json", "scripts/e04-library-browser-regression.mjs"];
const hashes = async paths => Object.fromEntries(await Promise.all(paths.map(async path => [path, digest(await readFile(resolve(root, path)))])));
const provenancePath = "tests/fixtures/sourceSnapshots/e04-library/provenance.json";
const provenance = JSON.parse(await readFile(resolve(root, provenancePath), "utf8"));
for (const file of provenance.files) {
    assert.equal(digest(await readFile(resolve(root, file.snapshot))), file.sha256, `Immutable snapshot ${file.snapshot}`);
    ownFiles.push(file.snapshot);
}
ownFiles.push(provenancePath);
const transactionProvenancePath = "tests/fixtures/sourceSnapshots/e04-library/independent-transactions/provenance.json";
const transactionProvenance = JSON.parse(await readFile(resolve(root, transactionProvenancePath), "utf8"));
assert.equal(digest(await readFile(resolve(root, transactionProvenance.snapshot))), transactionProvenance.sha256);
ownFiles.push(transactionProvenance.snapshot, transactionProvenancePath);
const beforeOwn = await hashes(ownFiles);
for (const path of ownFiles) {
    const target = resolve(outputDir, "sources", path);
    await mkdir(resolve(target, ".."), {recursive: true});
    await writeFile(target, await readFile(resolve(root, path)));
}
const loadedInputs = new Map();
const loadedSources = new Map();
const diagnostics = {
    name: "e04-library-observation-only", enforce: "pre",
    transform(input, id) {
        const path = relative(root, id.split("?")[0]);
        if (!path.startsWith("../") && !path.startsWith("node_modules/") && /\.(tsx?|css)$/.test(path)) {loadedInputs.set(path, digest(input)); loadedSources.set(path, input);}
        let source = input;
        if (id.endsWith("/src/components/studio/CoverCard.tsx")) {
            assert.ok(source.includes('aria-label={title} className='));
            source = source.replace('aria-label={title} className=', 'aria-label={title} data-e04-cover={mediaId ?? ""} className=');
        }
        if (id.endsWith("/ProjectGalleryPage.tsx")) {
            source = source.replace('const projects = useLiveQuery(() => db.projects.toArray(), [])', 'const projects = useLiveQuery(() => {window.e04Library.metrics.projectQueryCallbacks++; return db.projects.toArray();}, [])');
        }
        if (id.includes("/sourceSnapshots/e04-library/") && id.endsWith("/ProjectGalleryPage.tsx")) {
            source = source.replace('const shots = useLiveQuery(() => db.shots.toArray(), [])', 'const shots = useLiveQuery(async () => {const rows = await db.shots.toArray(); window.e04Library.output("before-gallery", rows); return rows;}, [])');
            source = source.replace('(shot) => shot.projectId === projectId', '(shot) => {window.e04Library.metrics.filterChecks++; return shot.projectId === projectId;}');
            source = source.replace('(left, right) => left.order - right.order', '(left, right) => {window.e04Library.metrics.sortComparisons++; return left.order - right.order;}');
        }
        if (id.endsWith("/src/lib/studioLibraryQueries.ts")) {
            source = source.replace('each(shot => {', 'each(shot => {window.e04Library.metrics.fallbackVisits++;');
            const result = 'return new Map([...candidates].map(([projectId, candidate]) => [projectId, candidate.mediaId]));';
            assert.ok(source.includes(result));
            source = source.replace(result, 'const result = new Map([...candidates].map(([projectId, candidate]) => [projectId, candidate.mediaId])); await window.e04Library.afterCover(projectIds, result); return result;');
        }
        if (id.endsWith("/AssetLibraryPages.tsx")) {
            for (const [fn, arg, type] of [["characterCover", "character", "Character"], ["sceneCover", "scene", "Scene"], ["propCover", "prop", "Prop"], ["styleCover", "style", "VisualStyle"]]) {
                source = source.replace(`function ${fn}(${arg}: ${type}) {`, `function ${fn}(${arg}: ${type}) {window.e04Library.metrics.assetCoverCalls++;`);
            }
            if (id.includes("/sourceSnapshots/e04-library/")) {
                for (const table of ["characters", "scenes", "props", "styles"]) {
                    const expression = `() => db.${table}.where("projectId").equals(STUDIO_LIBRARY_ID).toArray()`;
                    assert.ok(source.includes(expression));
                    source = source.replace(expression, `async () => {const rows = await db.${table}.where("projectId").equals(STUDIO_LIBRARY_ID).toArray(); window.e04Library.output("before-${table}", rows); return rows;}`);
                }
                for (const arg of ["character", "scene", "prop", "style"]) source = source.replace(`(${arg}) => ${arg}.id === id`, `(${arg}) => {window.e04Library.metrics.assetFindChecks++; return ${arg}.id === id;}`);
            } else {
                assert.ok(source.includes('return assets.map(asset => ({'));
                source = source.replace('return assets.map(asset => ({', 'const rows = assets.map(asset => ({');
                source = source.replace('source: asset, mediaId: cover(asset),\n    }));', 'source: asset, mediaId: cover(asset),\n    }));\n    await window.e04Library.afterAssets(table.name, rows); return rows;');
            }
        }
        return source;
    },
};
const {chromium} = await import(process.env.E04_PLAYWRIGHT_PATH ?? "playwright");
const cacheDir = await mkdtemp(join(tmpdir(), "e04-library-vite-"));
const server = await createServer({configFile: false, root, cacheDir, plugins: [diagnostics, react(), tailwindcss()],
    resolve: {alias: {"@": resolve(root, "src")}}, optimizeDeps: {entries: [resolve(root, "tests/fixtures/e04-library/index.html")]},
    server: {host: "127.0.0.1", port: 0, hmr: false, watch: {ignored: ["**/.trellis/**", "**/scripts/**"]}}});
let browser;
const results = [], errors = [], documents = [];
const observations = {};
let failure;
let page;
const assetTables = ["characters", "scenes", "props", "styles"];
const tableQueries = (report, table) => report.reads.filter(read => read.table === table).length;
const tableTransactions = (report, table) => new Set(report.reads.filter(read => read.table === table &&
    report.transactions.some(transaction => transaction.id === read.transactionId && transaction.mode === "readonly"))
    .map(read => read.transactionId)).size;
const tableRows = (report, table) => report.reads.filter(read => read.table === table).reduce((sum, read) => sum + read.rows, 0);
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.E04_CHROMIUM_PATH ? {executablePath: process.env.E04_CHROMIUM_PATH} : {})});
    page = await browser.newPage({viewport: {width: 1280, height: 900}});
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => {errors.push(error.message); console.error("pageerror", error.message);});
    page.on("request", request => {if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());});
    const fixtureUrl = server.resolvedUrls.local[0] + "tests/fixtures/e04-library/";
    await page.goto(fixtureUrl);
    await page.waitForFunction(() => Boolean(window.e04Library?.ids));
    const navigate = async to => {await page.evaluate(to => window.e04Library.navigate(to), to); await page.waitForFunction(to => window.e04Library.location() === to, to);};
    const reset = () => page.evaluate(() => window.e04Library.reset());
    const report = () => page.evaluate(() => window.e04Library.report());
    const quiet = () => page.waitForTimeout(200); // Bounded negative-subscription observation; no latency claim.
    const cover = title => page.getByRole("button", {name: title, exact: true});
    const coverIs = async (title, id) => {await page.waitForFunction(({title, id}) => [...document.querySelectorAll("button[data-e04-cover]")].some(el => el.getAttribute("aria-label") === title && el.getAttribute("data-e04-cover") === id), {title, id});};
    const search = value => page.getByPlaceholder("搜索…").fill(value);
    const cards = () => page.locator("button[data-e04-cover]").evaluateAll(elements => elements.map(el => ({title: el.getAttribute("aria-label"), cover: el.getAttribute("data-e04-cover")})));
    async function test(name, run) {
        await run(); assert.deepEqual(errors, []); assert.deepEqual(documents, [fixtureUrl]);
        results.push({name, status: "PASS"}); console.log(`PASS ${name}`);
    }

    await test("gallery before/current native reads, projection bytes and independent derivation counters", async () => {
        await reset(); await navigate("/before/gallery"); await coverIs("Alpha video", "alpha-first"); await quiet();
        observations.galleryBeforeCold = await report();
        assert.equal(tableRows(observations.galleryBeforeCold, "shots"), 1296);
        await page.getByRole("button", {name: "视频", exact: true}).click(); await quiet(); await reset();
        await page.evaluate(() => window.e04Library.db.shots.update("alpha-0", {notes: "before observation"}));
        await page.waitForFunction(() => window.e04Library.report().outputs.some(output => output.label === "before-gallery")); await quiet();
        observations.galleryBefore = await report(); observations.galleryBeforeCards = await cards();
        assert.equal(observations.galleryBefore.outputs[0].entries, 1296);
        assert.ok(observations.galleryBefore.metrics.filterChecks >= 1296 * 3);
        await reset(); await navigate("/gallery"); await coverIs("Alpha video", "alpha-first"); await quiet();
        observations.galleryCurrentCold = await report();
        assert.equal(tableQueries(observations.galleryCurrentCold, "shots"), 24, "one cursor request for each distinct fallback owner");
        assert.equal(tableTransactions(observations.galleryCurrentCold, "shots"), 1, "all owner cursor requests share one actual readonly transaction");
        assert.equal(observations.galleryCurrentCold.metrics.fallbackVisits, 1046);
        assert.equal(tableRows(observations.galleryCurrentCold, "shots"), 1046);
        await reset(); await page.getByRole("button", {name: "视频", exact: true}).click();
        await page.waitForFunction(() => window.e04Library.report().outputs.some(output => output.label === "current-gallery")); await quiet();
        observations.galleryCurrentFiltered = await report();
        assert.equal(tableQueries(observations.galleryCurrentFiltered, "shots"), 3, "three exact owner ranges, including the empty owner");
        assert.equal(tableTransactions(observations.galleryCurrentFiltered, "shots"), 1);
        assert.equal(observations.galleryCurrentFiltered.metrics.fallbackVisits, 45);
        assert.equal(tableRows(observations.galleryCurrentFiltered, "shots"), 45);
        await reset();
        await page.evaluate(() => window.e04Library.db.shots.update("alpha-0", {notes: "current observation"}));
        await page.waitForFunction(() => window.e04Library.report().outputs.some(output => output.label === "current-gallery")); await quiet();
        observations.galleryCurrent = await report(); observations.galleryCurrentCards = await cards();
        assert.deepEqual(observations.galleryCurrentCards, observations.galleryBeforeCards);
        assert.equal(tableQueries(observations.galleryCurrent, "shots"), 3);
        assert.equal(tableTransactions(observations.galleryCurrent, "shots"), 1);
        assert.equal(tableRows(observations.galleryCurrent, "shots"), 45);
        assert.equal(observations.galleryCurrent.metrics.fallbackVisits, 45);
        assert.equal(observations.galleryCurrent.outputs[0].entries, 2);
        assert.ok(observations.galleryCurrent.outputs[0].jsonBytes < observations.galleryBefore.outputs[0].jsonBytes / 1000);
        assert.equal(await cover("Explicit video").getAttribute("data-e04-cover"), "explicit-cover");
        assert.equal(await cover("Empty video").getAttribute("data-e04-cover"), "");
        assert.equal(await cover("Missing video").getAttribute("data-e04-cover"), "missing-media");
        assert.equal(await cover("Missing video").getByText("素材加载中或已不可用").isVisible(), true);
    });
    await test("original independent owner reads use N native readonly transactions; final exact ranges share one", async () => {
        const owners = ["alpha", "empty", "missing", "alpha"];
        await reset();
        const beforeCovers = await page.evaluate(async owners => [...await window.e04Library.readIndependentCovers(owners)], owners);
        observations.independentOwnerReads = await report();
        assert.equal(tableQueries(observations.independentOwnerReads, "shots"), 3);
        assert.equal(tableTransactions(observations.independentOwnerReads, "shots"), 3);
        assert.equal(tableRows(observations.independentOwnerReads, "shots"), 45);
        await reset();
        const afterCovers = await page.evaluate(async owners => [...await window.e04Library.readSharedCovers(owners)], owners);
        observations.sharedOwnerReads = await report();
        assert.deepEqual(afterCovers, beforeCovers);
        assert.equal(tableQueries(observations.sharedOwnerReads, "shots"), 3);
        assert.equal(tableTransactions(observations.sharedOwnerReads, "shots"), 1);
        assert.equal(tableRows(observations.sharedOwnerReads, "shots"), 45);
    });
    await test("an unselected owner insertion inside selected ID gaps does not rerun the cover subscription", async () => {
        await reset();
        await page.evaluate(async () => {
            const database = window.e04Library.db;
            await database.transaction("rw", database.shots, async () => {
                const row = await database.shots.get("b0");
                await database.shots.add({...row, id: "beta-gap-added", notes: "unselected owner inside alpha/empty/missing bounds"});
            });
        });
        await quiet(); observations.galleryGapInsert = await report();
        assert.equal(observations.galleryGapInsert.outputs.length, 0, "ID-gap owner insertion must not invalidate selected fallback owners");
        assert.equal(tableQueries(observations.galleryGapInsert, "shots"), 0);
        assert.equal(tableTransactions(observations.galleryGapInsert, "shots"), 0);
        assert.equal(observations.galleryGapInsert.metrics.fallbackVisits, 0);
        await page.evaluate(() => window.e04Library.db.shots.delete("beta-gap-added")); await quiet();
    });
    await test("filtered-out, archived and explicit-owner shot writes avoid fallback subscription work", async () => {
        await reset();
        await page.evaluate(async () => {
            await window.e04Library.db.shots.update("hidden-1", {notes: "irrelevant hidden"});
            await window.e04Library.db.shots.update("archived-1", {notes: "irrelevant archived"});
            await window.e04Library.db.shots.update("explicit-1", {notes: "irrelevant explicit"});
        }); await quiet();
        const result = await report(); observations.galleryIrrelevant = result;
        assert.equal(tableRows(result, "shots"), 0); assert.equal(result.metrics.fallbackVisits, 0);
        assert.equal(result.outputs.length, 0);
    });
    await test("explicit-cover-only search performs no shot read, while project metadata and explicit cover refresh", async () => {
        await search("Explicit video"); await quiet(); await reset();
        await page.evaluate(async () => {
            await window.e04Library.db.shots.update("explicit-2", {notes: "explicit only"});
            await window.e04Library.db.projects.update("explicit", {coverMediaId: "updated-cover"});
            await window.e04Library.db.projects.update("hidden-1", {brief: "filtered-out project metadata"});
        });
        await coverIs("Explicit video", "updated-cover"); await quiet();
        observations.explicitOnly = await report();
        assert.equal(tableRows(observations.explicitOnly, "shots"), 0);
        assert.ok(observations.explicitOnly.metrics.projectQueryCallbacks > 0, "project metadata remains a global list query; native reads may be cached");
        await page.evaluate(() => window.e04Library.db.projects.update("explicit", {coverMediaId: "explicit-cover"}));
    });
    await test("clearing an explicit project cover starts its fallback query; restoring it drops that shot scope", async () => {
        await quiet(); await reset();
        await page.evaluate(() => window.e04Library.db.projects.update("explicit", {coverMediaId: undefined}));
        await coverIs("Explicit video", "explicit-fallback"); await quiet();
        observations.explicitCleared = await report();
        assert.equal(tableRows(observations.explicitCleared, "shots"), 200);
        assert.equal(observations.explicitCleared.metrics.fallbackVisits, 200);
        await page.evaluate(() => window.e04Library.db.projects.update("explicit", {coverMediaId: "explicit-cover"}));
        await coverIs("Explicit video", "explicit-cover"); await quiet(); await reset();
        await page.evaluate(() => window.e04Library.db.shots.update("explicit-3", {notes: "scope removed again"}));
        await quiet(); assert.equal(tableRows(await report(), "shots"), 0);
    });
    await test("relevant first-frame writes and removal refresh fallback without changing missing-media semantics", async () => {
        await search("Alpha video"); await coverIs("Alpha video", "alpha-first");
        await page.evaluate(() => window.e04Library.db.shots.update("a1", {firstFrame: {prompt: "", referenceImageIds: [], referenceVideoIds: [], result: {mediaId: "updated-cover", kind: "image"}}}));
        await coverIs("Alpha video", "updated-cover");
        await page.evaluate(() => window.e04Library.db.shots.update("a1", {firstFrame: {prompt: "", referenceImageIds: [], referenceVideoIds: []}}));
        await coverIs("Alpha video", "alpha-second");
        await page.evaluate(() => window.e04Library.db.shots.update("a1", {firstFrame: {prompt: "", referenceImageIds: [], referenceVideoIds: [], result: {mediaId: "alpha-first", kind: "image"}}}));
        await coverIs("Alpha video", "alpha-first");
    });
    await test("held intersecting fallback query cannot expose prior scope covers; newer filter wins after old release", async () => {
        await search(""); await coverIs("Alpha video", "alpha-first"); await reset();
        const scope = JSON.stringify(["alpha"]);
        await page.evaluate(scope => window.e04Library.hold(scope), scope);
        await search("Alpha video");
        await page.waitForFunction(scope => window.e04Library.report().held.includes(scope), scope);
        assert.equal(await cover("Alpha video").getAttribute("data-e04-cover"), "", "old multi-owner result is hidden under the single-owner identity");
        await search(""); await page.getByRole("button", {name: "音频", exact: true}).click();
        await coverIs("Beta audio", "beta-first");
        await page.evaluate(scope => window.e04Library.release(scope), scope); await quiet();
        assert.equal(await cover("Alpha video").count(), 0); assert.equal(await cover("Beta audio").getAttribute("data-e04-cover"), "beta-first");
        observations.heldGallery = await report();
    });
    await test("gallery IP/archive/search/sort transitions retain the visible-owner contract", async () => {
        await page.getByRole("button", {name: "视频", exact: true}).click(); await coverIs("Alpha video", "alpha-first");
        await page.getByRole("combobox", {name: "筛选所属 IP"}).click(); await page.getByRole("option", {name: "Alpha IP", exact: true}).click();
        await quiet(); assert.deepEqual((await cards()).map(row => row.title), ["Alpha video"]);
        await page.getByRole("combobox", {name: "筛选所属 IP"}).click(); await page.getByRole("option", {name: "全部", exact: true}).click();
        await page.getByRole("checkbox").click(); await coverIs("Archived video", "alpha-second");
        assert.deepEqual((await cards()).map(row => row.title), ["Archived video"]);
        await page.getByRole("checkbox").click(); await coverIs("Alpha video", "alpha-first");
        await page.getByRole("combobox").first().click(); await page.getByRole("option", {name: "按名称", exact: true}).click();
        await quiet(); assert.deepEqual((await cards()).map(row => row.title), ["Alpha video", "Empty video", "Explicit video", "Missing video"]);
        await search("absent"); await page.getByText("没有找到匹配的项目", {exact: true}).waitFor();
    });

    for (const [kind, table, name, coverId, textField] of [["character", "characters", "Character", "character-cover", "bio"], ["scene", "scenes", "Scene", "scene-cover", "location"], ["prop", "props", "Prop", "prop-cover", "usage"], ["style", "styles", "Style", "style-cover", "palette"]]) {
        await test(`${kind}: actual before/current typed covers; only current table reads; unrelated writes do not rerun`, async () => {
            await navigate("/away"); await reset(); await navigate(`/before/${table}`); await coverIs(`${name} 0`, coverId); await quiet();
            const baseline = await report();
            assert.deepEqual(baseline.outputs.map(output => output.label).sort(), assetTables.map(table => `before-${table}`).sort());
            assert.ok(baseline.outputs.every(output => output.entries === 30));
            assert.ok(assetTables.every(table => [0, 30].includes(tableRows(baseline, table))));
            assert.ok(baseline.metrics.assetFindChecks >= 465);
            const beforeCards = await cards();
            await navigate("/away"); await reset(); await navigate(`/${table}`); await coverIs(`${name} 0`, coverId); await quiet();
            const current = await report();
            assert.ok([0, 30].includes(tableRows(current, table)), "Dexie may reuse a cached matching query");
            assert.ok(assetTables.filter(other => other !== table).every(other => tableRows(current, other) === 0));
            assert.deepEqual(current.outputs.map(output => output.label), [`current-${table}`]);
            assert.equal(current.outputs[0].entries, 30);
            assert.equal(current.metrics.assetFindChecks, 0); assert.equal(current.metrics.assetCoverCalls, 30);
            assert.deepEqual(await cards(), beforeCards);
            observations[kind] = {baseline, current};
            await reset();
            await page.evaluate(async ({table, others}) => {
                for (const other of others) await window.e04Library.db.table(other).update("identitynever-01", {notes: `other-kind change while ${table}`});
                await window.e04Library.db.characters.update("foreign-character", {notes: "foreign owner change"});
            }, {table, others: assetTables.filter(other => other !== table)}); await quiet();
            const irrelevant = await report(); observations[kind].irrelevant = irrelevant;
            assert.equal(assetTables.reduce((sum, table) => sum + tableRows(irrelevant, table), 0), 0);
            assert.equal(irrelevant.metrics.assetCoverCalls, 0); assert.equal(irrelevant.outputs.length, 0);
            await page.evaluate(async ({table, name}) => {
                const row = await window.e04Library.db.table(table).get("identitynever-00");
                const slot = {characters: "front", scenes: "wide", props: "hero", styles: "look"}[table];
                await window.e04Library.db.table(table).update(row.id, {name: `${name} updated`, slots: {...row.slots, [slot]: {prompt: "", referenceImageIds: [], referenceVideoIds: [], result: {mediaId: "updated-cover", kind: "image"}}}});
            }, {table, name}); await coverIs(`${name} updated`, "updated-cover");
            await search("authoredneedle"); await quiet(); assert.deepEqual((await cards()).map(row => row.title), [`${name} updated`]);
            await search(`${{bio: "biography", location: "location", usage: "usage", palette: "palette"}[textField]}-0`); await quiet(); assert.equal((await cards()).length, 1);
            for (const excluded of ["identitynever", "provenancenever", "updated-cover"]) {await search(excluded); await quiet(); assert.equal((await cards()).length, 0);}
            await search(""); await quiet();
            await page.getByRole("combobox").click(); await page.getByRole("option", {name: "按名称", exact: true}).click(); await quiet();
            const sorted = (await cards()).map(row => row.title); assert.deepEqual(sorted, [...sorted].sort((a, b) => a.localeCompare(b, "zh-CN")));
            await cover(`${name} updated`).click(); // Real page navigation uses its kind-specific route.
            assert.equal(await page.evaluate(() => window.e04Library.location()), `/${table}/identitynever-00`);
        });
    }
    await test("held character result cannot populate the keyed scene owner", async () => {
        await navigate("/away"); await page.evaluate(() => window.e04Library.hold("asset:characters"));
        await navigate("/characters"); await page.waitForFunction(() => window.e04Library.report().held.includes("asset:characters"));
        await navigate("/scenes"); await coverIs("Scene updated", "updated-cover");
        await page.evaluate(() => window.e04Library.release("asset:characters")); await quiet();
        assert.equal((await cards()).some(row => row.title.startsWith("Character")), false);
        assert.equal(await cover("Scene updated").getAttribute("data-e04-cover"), "updated-cover");
        observations.heldAsset = await report();
    });
    await test("current-kind deletion removes its row; empty search remains a settled missing result", async () => {
        await page.evaluate(() => window.e04Library.db.scenes.delete("identitynever-29"));
        await cover("Scene 29").waitFor({state: "detached"}); assert.equal((await cards()).length, 29);
        await search("Scene 29"); await page.getByText("没有匹配的资产，试试其他关键词。", {exact: true}).waitFor();
        assert.equal((await cards()).length, 0); await search(""); await coverIs("Scene updated", "updated-cover");
    });
    await test("native selected media pixels and narrow page remain renderable", async () => {
        await page.waitForFunction(() => [...document.querySelectorAll("button[data-e04-cover] img")].some(img => img.complete && img.naturalWidth === 1));
        await page.setViewportSize({width: 390, height: 844}); await quiet();
        await page.screenshot({path: join(outputDir, "narrow-assets.png"), fullPage: true});
        await navigate("/gallery"); await coverIs("Alpha video", "alpha-first");
        await page.screenshot({path: join(outputDir, "narrow-gallery.png"), fullPage: true});
    });
} catch (error) {
    failure = {message: error.message, stack: error.stack}; console.error(error);
    if (page) {
        await page.screenshot({path: join(outputDir, "failure.png"), fullPage: true});
        await writeFile(join(outputDir, "failure.html"), await page.content());
        try {observations.failure = await page.evaluate(() => window.e04Library?.report());} catch { /* Original failure retained. */ }
    }
} finally {
    const closure = Object.fromEntries(loadedInputs);
    for (const [path, source] of loadedSources) {
        const target = resolve(outputDir, "loaded-sources", path);
        await mkdir(resolve(target, ".."), {recursive: true});
        await writeFile(target, source);
    }
    const afterOwn = await hashes(ownFiles);
    const changedOwn = ownFiles.filter(path => beforeOwn[path] !== afterOwn[path]);
    const currentClosure = await hashes(Object.keys(closure));
    const concurrentClosureChanges = Object.keys(closure).filter(path => closure[path] !== currentClosure[path]);
    if (changedOwn.length) failure ??= {message: `Own-scope source changed during proof: ${changedOwn.join(", ")}`};
    await writeFile(join(outputDir, "report.json"), JSON.stringify({status: failure ? "FAIL" : "PASS", scenarios: results, errors, documents, observations,
        environment: {node: process.version, playwright: process.env.E04_PLAYWRIGHT_PATH ?? "playwright", chromium: process.env.E04_CHROMIUM_PATH, cacheDir},
        source: {ownBefore: beforeOwn, ownAfter: afterOwn, loadedClosure: closure, afterClosure: currentClosure, concurrentClosureChanges},
        limits: ["Native cursor/getAll counts returned complete rows, not physical disk IO or column projection. Exact owner equals ranges use N cursor requests inside one readonly transaction. Query count, transaction count, complete returned rows and reducer/output counts are separate metrics.", "Default Dexie caching can reuse warmed full-query arrays with zero additional native reads; warm native row counts and callback rows are separate.", "JSON bytes measure object data excluding Blob bytes, not allocations/network bytes.", "Callback counters describe derivation work, not elapsed latency.", "Negative subscription observations are bounded 200ms waits after committed writes.", "Only own scope is frozen; other E04 writers may change shared imported roots. Whole integration belongs to the coordinator."], failure}, null, 2) + "\n");
    await browser?.close(); await server.close(); await rm(cacheDir, {recursive: true, force: true});
}
console.log(`E04 library: ${results.length} scenarios; ${failure ? "FAIL" : "PASS"}; evidence ${outputDir}`);
if (failure) process.exitCode = 1;
