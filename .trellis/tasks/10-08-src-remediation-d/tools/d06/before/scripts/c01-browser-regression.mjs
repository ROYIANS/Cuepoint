import assert from "node:assert/strict";
import {createServer} from "vite";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const {chromium} = await import(process.env.C01_PLAYWRIGHT_PATH ?? "playwright");
const baseline = {name: "c01-original-source", enforce: "pre", async transform(source, id) {
    if (!process.env.C01_BASELINE_ROOT) return source;
    for (const file of ["src/db/agentTaskRecords.ts", "src/lib/agent/wrapupEvidence.ts"]) if (id.endsWith("/" + file)) return readFile(join(process.env.C01_BASELINE_ROOT, file), "utf8");
    return source;
}};
const server = await createServer({configFile: false, plugins: [baseline], resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 0}});
let browser;
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.C01_CHROMIUM_PATH ? {executablePath: process.env.C01_CHROMIUM_PATH} : {})});
    const page = await browser.newPage();
    const errors = []; let externalRequests = 0;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();} return route.continue();});
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/c01/");
    await page.waitForFunction(() => Boolean(window.c01));
    const result = await page.evaluate(() => window.c01.run());
    assert.equal(result.checks, 6);
    assert.equal(externalRequests, 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({...result, externalRequests, browser: "Chromium native IndexedDB", limitation: "Synthetic nonempty media metadata, no pixel decode, external provider or full product UI"}));
} finally {await browser?.close(); await server.close();}
