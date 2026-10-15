import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

// Current registry identity is intentionally reviewed. Fresh-development changes
// update this pin and all actual owners; they do not authorize a new migration.
// The named 49-to-50 recipe remains restricted to its original target hash.
const PINNED_REGISTRY_HASH="867d327e86650f8df0464bef1e63975df895b0905afc703cb10932d6a2afc35e";

describe("table registry hash",()=>{
    it("matches the reviewed current registry identity",()=>{
        const bytes=readFileSync(new URL("../packages/studio/src/platform/storage/schema.json",import.meta.url));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(PINNED_REGISTRY_HASH);
    });
});
