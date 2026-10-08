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
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/c01/");
    const result = await page.evaluate(async () => {
        const fixture = await import("/tests/fixtures/d01/harness.ts");
        return {single: await fixture.runSingleBoundary(), batch: await fixture.runBatchBoundary(), guard: await fixture.runTaskGuardBoundary()};
    });
    assert.equal(externalRequests, 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({...result, externalRequests, browser: "Chromium native IndexedDB", limitation: "Local synthetic downloaded media; no provider, decoding or full product UI"}));
} finally {await browser?.close(); await server.close();}
