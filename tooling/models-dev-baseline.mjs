import {readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {projectBaseline as projectShared} from "../packages/studio/src/features/settings/modelCatalog/projection.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE_PATH = join(root, "packages/studio/src/features/settings/modelCatalog/scope.json");
export const BASELINE_PATH = join(root, "packages/studio/src/features/settings/modelCatalog/baseline.generated.json");
export const BASELINE_FORMAT = 1;

/** Pure projection of a Models.dev snapshot into the committed baseline (no wall clock). */
export function projectBaseline(input, scope) {
    return projectShared(input, scope, BASELINE_FORMAT);
}

/** Differences ignoring the wall-clock `generatedAt` stamp. Empty means equal. */
export function compareBaseline(committed, fresh) {
    const strip = ({generatedAt: _ignored, ...rest}) => rest;
    const problems = [];
    if (committed?.packageVersion !== fresh.packageVersion) problems.push(`package version ${committed?.packageVersion} != installed ${fresh.packageVersion}`);
    if (JSON.stringify(strip(committed ?? {})) !== JSON.stringify(strip(fresh))) problems.push("baseline content differs from a fresh projection");
    return problems;
}

async function loadInstalled() {
    const snapshot = await import("@opencode-ai/models/snapshot");
    const pkg = JSON.parse(readFileSync(join(root, "node_modules/@opencode-ai/models/package.json"), "utf8"));
    return {providers: snapshot.providers, snapshotGeneratedAt: snapshot.generatedAt, packageVersion: pkg.version};
}

function declaredVersion() {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return pkg.devDependencies?.["@opencode-ai/models"];
}

async function main(command) {
    const scope = JSON.parse(readFileSync(SCOPE_PATH, "utf8"));
    const fresh = projectBaseline(await loadInstalled(), scope);
    if (command === "generate") {
        writeFileSync(BASELINE_PATH, `${JSON.stringify({...fresh, generatedAt: new Date().toISOString()})}\n`);
        console.log(`models-dev baseline: ${fresh.entries.length} entries, package ${fresh.packageVersion}`);
        return;
    }
    if (command === "verify") {
        const problems = [];
        if (declaredVersion() !== fresh.packageVersion) problems.push(`package.json pins ${declaredVersion()} but ${fresh.packageVersion} is installed`);
        problems.push(...compareBaseline(JSON.parse(readFileSync(BASELINE_PATH, "utf8")), fresh));
        if (problems.length) {
            console.error(`models-dev baseline verification failed:\n- ${problems.join("\n- ")}\nRun pnpm models-dev:baseline and commit the result.`);
            process.exitCode = 1;
            return;
        }
        console.log(`models-dev baseline OK (${fresh.entries.length} entries, package ${fresh.packageVersion})`);
        return;
    }
    console.error("usage: models-dev-baseline.mjs generate|verify");
    process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
