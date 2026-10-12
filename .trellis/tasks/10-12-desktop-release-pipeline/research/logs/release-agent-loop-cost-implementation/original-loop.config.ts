import base from "/Users/xiaomengdao/WebstormProjects/aifenjing/vitest.config";
import {defineConfig} from "vitest/config";
import {readFileSync} from "node:fs";
const original = readFileSync(new URL("./original-runChat.ts", import.meta.url), "utf8");
export default defineConfig({...base, plugins: [{name: "task-only-original-execution-loop", enforce: "pre", transform(_code, id) {
    if (id === "/Users/xiaomengdao/WebstormProjects/aifenjing/src/lib/agent/runChat.ts") return {code: original, map: null};
}}, ...base.plugins ?? []]});
