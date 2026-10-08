import assert from "node:assert/strict";
import {createServer} from "vite";
import {resolve} from "node:path";
const {chromium} = await import(process.env.C01_PLAYWRIGHT_PATH ?? "playwright");
const server = await createServer({configFile: false, resolve: {alias: {"@": resolve("src")}}, server: {host: "127.0.0.1", port: 0}});
let browser;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.C01_CHROMIUM_PATH ? {executablePath: process.env.C01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage();
    const errors = []; let externalRequests = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
        if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();}
        return route.continue();
    });
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/d02/");
    const result = await page.evaluate(async () => {
        const fixture = await import("/tests/fixtures/d02/harness.ts");
        const {db} = await import("/src/db/database.ts");
        const results = {};
        for (const [name, command] of Object.entries({project: fixture.runProjectCascadeBoundary, thread: fixture.runThreadCascadeBoundary, release: fixture.runMaterialReleaseBoundary})) {
            await db.delete(); await db.open();
            results[name] = await command();
        }
        db.close();
        return results;
    });
    assert.equal(result.project.lateFault, true); assert.equal(result.project.deletedChildren, true);
    assert.equal(result.thread.lateFault, true); assert.equal(result.thread.deletedHistories, true);
    assert.equal(result.release.lateFault, true); assert.equal(result.release.deletedCopy, true);
    assert.equal(externalRequests, 0); assert.deepEqual(errors, []);
    console.log(JSON.stringify({...result, rollbackChecks: 3, successfulRetryChecks: 3, externalRequests, pageErrors: errors.length, browser: "Chromium native IndexedDB", limitation: "Local synthetic bytes/history; no provider submission, decode/playback or full product UI"}));
} finally {await browser?.close(); await server.close();}
