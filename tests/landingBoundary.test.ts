import {readdirSync, readFileSync} from "node:fs";
import {dirname, join, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const landingRoot = join(sourceRoot, "landing");
// The only application modules the standalone entry may use: dependency-free ones.
const APP_ALLOWED = new Set(["@/lib/umami", "@/lib/brand"]);
const PACKAGE_ALLOWED = /^(react|react-dom|react\/jsx-runtime|react-dom\/client|motion|motion\/.+)$/;

function listFiles(directory: string): string[] {
    return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}

function specifiers(source: string): string[] {
    const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
    return [...source.matchAll(pattern)].map(match => match[1]);
}

function isAllowed(specifier: string): boolean {
    if (specifier.startsWith(".")) return true;
    if (specifier.startsWith("@/")) return APP_ALLOWED.has(specifier);
    return PACKAGE_ALLOWED.test(specifier);
}

describe("landing source boundary", () => {
    it("imports only relative modules, React, motion and the dependency-free umami/brand modules", () => {
        const files = listFiles(landingRoot).filter(file => /\.(tsx?|css)$/.test(file));
        expect(files.length).toBeGreaterThan(0);
        const bad = files.flatMap(file => specifiers(readFileSync(file, "utf8")).filter(item => !isAllowed(item)).map(item => `${file.replace(sourceRoot, "src")}: ${item}`));
        expect(bad).toEqual([]);
    });

    it("rejects application, storage, router, Tauri and UI-library imports", () => {
        const rejected = ["@/db/database", "@/lib/storage/hooks", "@/components/ui/button", "@/styles.css", "dexie", "zod",
            "@tanstack/react-router", "@tauri-apps/api/core", "antd", "@lobehub/ui", "../main", "@/main"];
        expect(rejected.filter(isAllowed)).toEqual(["../main"]); // relative paths are checked by the real-file scan above
        expect(specifiers(`import {a} from "dexie"; import("zod"); import "@/db/x"; export * from "antd";`)).toEqual(["dexie", "zod", "@/db/x", "antd"]);
    });

    it("keeps the shared modules dependency-free", () => {
        for (const file of ["lib/umami.ts", "lib/brand.ts"]) expect(specifiers(readFileSync(join(sourceRoot, file), "utf8")), file).toEqual([]);
    });

    it("keeps relative imports inside src/landing", () => {
        const escaping = listFiles(landingRoot).filter(file => /\.tsx?$/.test(file)).flatMap(file =>
            specifiers(readFileSync(file, "utf8")).filter(item => item.startsWith(".")).filter(item => {
                const target = resolve(dirname(file), item);
                return target !== landingRoot && !target.startsWith(landingRoot + sep);
            }).map(item => `${file}: ${item}`));
        expect(escaping).toEqual([]);
    });
});
