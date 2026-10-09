import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeEnabled = Boolean(process.env.E07_PLAYWRIGHT_PATH && process.env.E07_CHROMIUM_PATH);

type NativeCase = {
    shape: "primitive" | "memo";
    status: string;
    contractErrors: Array<{name: string; message: string}>;
    observation: {
        pending: {draft: string; status: string};
        settled: {draft: string; db: string; status: string};
        afterUnrelated: {draft: string; db: string; status: string};
    };
};
type NativeReport = {status: string; unchanged: boolean; cases: NativeCase[]};
async function runNative(variant: "current" | "regression", directory: string) {
    const log: string[] = [];
    const exit = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(root, "scripts/e07-draft-rebase-browser.mjs"), variant], {
            cwd: root, env: {...process.env, E07_DRAFT_REBASE_OUTPUT_DIR: directory}, stdio: ["ignore", "pipe", "pipe"],
        });
        child.stdout.on("data", data => log.push(String(data)));
        child.stderr.on("data", data => log.push(String(data)));
        child.once("error", reject);
        child.once("close", resolve);
    });
    let report: NativeReport;
    try {report = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8")) as NativeReport;}
    catch (error) {throw new Error(`Native ${variant} produced no report: ${log.join("")}`, {cause: error});}
    return {exit, report, log: log.join("")};
}

describe("E07 deferred external draft rebase", () => {
    it("retains the exact dependency-only counterexample independently of task archives", async () => {
        const fixture = path.join(root, "tests/fixtures/e07-draft-rebase");
        const provenance = JSON.parse(await readFile(path.join(fixture, "provenance.json"), "utf8")) as {sha256: string; snapshotPath: string};
        const original = await readFile(path.join(root, provenance.snapshotPath));
        expect(createHash("sha256").update(original).digest("hex")).toBe(provenance.sha256);
    });

    // Native ReactDOM is opt-in where Chromium exists. No fake-react/jsdom fallback:
    // export E07_PLAYWRIGHT_PATH and E07_CHROMIUM_PATH to run this in the root test command.
    it.skipIf(!nativeEnabled)("rebases stable primitive/memo external values after a real durable save settles; exact old source fails the same contract", async () => {
        const retainedOutput = process.env.E07_DRAFT_REBASE_TEST_OUTPUT_DIR;
        const directory = retainedOutput ?? await mkdtemp(path.join(tmpdir(), "e07-draft-rebase-test-"));
        let succeeded = false;
        try {
            const old = await runNative("regression", path.join(directory, "regression"));
            expect(old.exit, old.log).toBe(1);
            expect(old.report.status).toBe("FAIL");
            expect(old.report.unchanged).toBe(true);
            expect(old.report.cases.map(item => item.shape)).toEqual(["primitive", "memo"]);
            for (const item of old.report.cases) {
                expect(item.status).toBe("FAIL");
                expect(item.contractErrors.map(error => error.name)).toEqual([
                    "settled-latest-external", "unrelated-render-keeps-latest-external",
                ]);
                expect(item.observation.pending).toEqual({draft: "Local edit", status: "保存中…"});
                expect(item.observation.settled).toEqual({draft: "Local edit", db: "External newest", status: "已保存"});
                expect(item.observation.afterUnrelated).toEqual(item.observation.settled);
            }
            const current = await runNative("current", path.join(directory, "current"));
            expect(current.exit, current.log).toBe(0);
            expect(current.report.status).toBe("PASS");
            expect(current.report.unchanged).toBe(true);
            expect(current.report.cases.map(item => item.shape)).toEqual(["primitive", "memo"]);
            for (const item of current.report.cases) {
                expect(item.status).toBe("PASS");
                expect(item.contractErrors).toEqual([]);
                expect(item.observation.pending).toEqual({draft: "Local edit", status: "保存中…"});
                expect(item.observation.settled).toEqual({draft: "External newest", db: "External newest", status: "已保存"});
                expect(item.observation.afterUnrelated).toEqual(item.observation.settled);
            }
            succeeded = true;
        } finally {
            // Explicit output or any failing attempt remains available for review.
            if (succeeded && !retainedOutput) await rm(directory, {recursive: true, force: true});
        }
    }, 60000);
});
