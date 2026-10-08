import assert from "node:assert/strict";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
const {chromium} = await import(process.env.C02_PLAYWRIGHT_PATH ?? "playwright");
const baseline = {name: "c02-original-music-ui", enforce: "pre", async transform(source, id) {
    if (process.env.C02_BASELINE_ROOT && id.endsWith("/src/components/music/MusicCreation.tsx")) return readFile(join(process.env.C02_BASELINE_ROOT,"MusicCreation.tsx"),"utf8");
    return source;
}};
const server = await createServer({configFile: false, plugins: [baseline, react()], resolve: {alias: {"@": fileURLToPath(new URL("../src", import.meta.url))}}, server: {host: "127.0.0.1", port: 0}});
let browser; let passed = 0; let externalRequests = 0;
async function fixture() {
    const context = await browser.newContext();
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {if (new URL(route.request().url()).hostname !== "127.0.0.1") {externalRequests++; return route.abort();} return route.continue();});
    await page.goto(server.resolvedUrls.local[0] + "tests/fixtures/c02/");
    await page.waitForFunction(() => Boolean(window.c02));
    await page.getByRole("textbox", {name: "音乐描述", exact: true}).waitFor();
    if (process.env.C02_BASELINE_ROOT) console.log(JSON.stringify({baselineUIReady: true, savedDuration: (await page.evaluate(() => window.c02.state())).settings.durationSec, visibleDurationControls: await page.getByRole("spinbutton", {name:"期望时长",exact:true}).count(), externalRequests, pageErrors: errors}));
    const repair = page.getByRole("button", {name: /清除.*时长|修复.*时长/});
    await repair.waitFor({timeout: 5000});
    return {context,page,errors,repair};
}
try {
    await server.listen();
    browser = await chromium.launch({headless: true, ...(process.env.C02_CHROMIUM_PATH ? {executablePath: process.env.C02_CHROMIUM_PATH} : {})});
    {
        const {context,page,errors,repair} = await fixture();
        assert.equal((await page.evaluate(() => window.c02.state())).settings.durationSec, 30.5);
        await page.getByRole("textbox", {name: "音乐描述", exact: true}).fill("my retained words");
        const invalid = await page.evaluate(() => window.c02.flush());
        assert.equal(invalid.ok, false);
        await repair.click();
        assert.deepEqual(await page.evaluate(() => window.c02.flush()), {ok:true});
        const saved = await page.evaluate(() => window.c02.state());
        assert.equal(saved.settings.durationSec, undefined);
        assert.equal(saved.settings.prompt, "my retained words");
        assert.equal(await page.getByRole("textbox", {name: "音乐描述", exact:true}).inputValue(), "my retained words");
        await repair.waitFor({state:"hidden"});
        assert.deepEqual(errors, []); passed++;
        await context.close();
    }
    {
        const {context,page,errors,repair} = await fixture();
        await page.getByRole("textbox", {name:"音乐描述",exact:true}).fill("my conflicting words");
        await page.evaluate(() => window.c02.externalWrite());
        await repair.click();
        const conflict = await page.evaluate(() => window.c02.flush());
        assert.equal(conflict.ok, false);
        assert.match(conflict.message, /修改|冲突|变化/);
        assert.equal((await page.evaluate(() => window.c02.state())).settings.prompt, "remote writer");
        assert.equal(await page.getByRole("textbox", {name:"音乐描述",exact:true}).inputValue(), "my conflicting words");
        await page.getByRole("button", {name:"采用最新内容",exact:true}).click();
        await page.waitForFunction(() => document.querySelector('[aria-label="音乐描述"]').value === "remote writer");
        assert.deepEqual(errors, []); passed++;
        await context.close();
    }
    {
        const {context,page,errors,repair} = await fixture();
        await page.evaluate(() => window.c02.switching(true));
        await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => /清除.*时长|修复.*时长/.test(button.textContent) && button.disabled));
        assert.equal(await repair.isDisabled(), true);
        assert.equal((await page.evaluate(() => window.c02.state())).settings.durationSec, 30.5);
        assert.deepEqual(errors, []); passed++;
        await context.close();
    }
    assert.equal(externalRequests, 0);
    console.log(JSON.stringify({passed, externalRequests, browser:"Chromium native React/Radix/IndexedDB", limitation:"Actual MusicCreation and draft/CAS; no provider request or full production workspace route"}));
} finally {await browser?.close(); await server.close();}
