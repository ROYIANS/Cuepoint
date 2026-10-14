import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

// Installed desktop workspaces store the SHA-256 of schema.json and refuse to open when it differs.
// If this test fails you changed the table registry: add a migration for the previous hash in
// desktop/tauri/src-tauri/src/full_product_store/mod.rs (see migrate_registry), then update the
// pinned hash below. Shipped hashes: a3405d19… (desktop-v0.1.0/0.1.1), 3c897189… (desktop-v0.1.2).
const PINNED_REGISTRY_HASH="3c897189ef6f71517c55c86b5d24b7f9cd0e1cfd88d1b916b46345662187eff0";

describe("table registry hash",()=>{
    it("matches the pinned hash so installed workspaces keep opening",()=>{
        const bytes=readFileSync(new URL("../src/lib/storage/schema.json",import.meta.url));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(PINNED_REGISTRY_HASH);
    });
});
