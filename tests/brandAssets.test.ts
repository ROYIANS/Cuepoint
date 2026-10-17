import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {join, resolve} from "node:path";
import {describe, expect, it} from "vitest";

const root = process.cwd();
const brandDir = resolve(root, "packages/distribution/public/brand");
const read = (name: string) => readFileSync(join(brandDir, name));

function pngSize(buf: Buffer) {
    expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
    return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25]};
}

function webpInfo(buf: Buffer) {
    expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
    const kind = buf.subarray(12, 16).toString("ascii");
    if (kind === "VP8X") {
        return {width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), alpha: (buf[20] & 0x10) !== 0};
    }
    expect(kind).toBe("VP8L");
    const bits = buf.readUInt32LE(21);
    return {width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, alpha: ((bits >> 28) & 1) === 1};
}

function icoSizes(buf: Buffer) {
    expect(buf.readUInt16LE(0)).toBe(0);
    expect(buf.readUInt16LE(2)).toBe(1);
    const count = buf.readUInt16LE(4);
    return Array.from({length: count}, (_, i) => buf[6 + i * 16] || 256).sort((a, b) => a - b);
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        if (["node_modules", "dist", "target", ".git", "fixtures"].includes(entry.name)) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path, out);
        else if (/\.(ts|tsx|html|css|json|mjs|md)$/.test(entry.name)) out.push(path);
    }
    return out;
}

describe("brand assets", () => {
    it("ships every referenced /brand file", () => {
        const sources = ["packages/distribution/src/brand.ts", "apps/web/index.html", "apps/desktop/index.html", "apps/site/landing.html"];
        const names = new Set<string>();
        for (const source of sources) {
            const text = readFileSync(resolve(root, source), "utf8");
            for (const m of text.matchAll(/\/brand\/([A-Za-z0-9._-]+)/g)) names.add(m[1]);
        }
        expect(names.size).toBeGreaterThan(4);
        for (const name of names) expect(existsSync(join(brandDir, name)), name).toBe(true);
    });

    it("has the expected file set", () => {
        expect(readdirSync(brandDir).sort()).toEqual([
            "README.md", "apple-touch-icon.png", "favicon.ico", "logo-16.png", "logo-32.png", "logo-48.png",
            "logo-loop.mp4", "logo.webp", "og-card.png", "sponsor-wechat.jpg",
        ]);
    });

    it("has correct image dimensions", () => {
        expect(webpInfo(read("logo.webp"))).toEqual({width: 1024, height: 1024, alpha: true});
        for (const size of [16, 32, 48]) {
            const info = pngSize(read(`logo-${size}.png`));
            expect([info.width, info.height]).toEqual([size, size]);
        }
        const touch = pngSize(read("apple-touch-icon.png"));
        expect([touch.width, touch.height]).toEqual([180, 180]);
        expect([2, 0]).toContain(touch.colorType);
        const card = pngSize(read("og-card.png"));
        expect([card.width, card.height]).toEqual([1200, 630]);
        expect(icoSizes(read("favicon.ico"))).toEqual([16, 32, 48]);
        expect(statSync(join(brandDir, "logo.webp")).size).toBeGreaterThan(1000);
    });

    it("ships a lightweight hero animation with no audio track", () => {
        const buf = read("logo-loop.mp4");
        expect(buf.subarray(4, 8).toString("ascii")).toBe("ftyp");
        expect(buf.includes(Buffer.from("soun", "ascii"))).toBe(false);
        expect(buf.includes(Buffer.from("avc1", "ascii"))).toBe(true);
        // 120 CSS px at up to 3x only needs 360 device pixels.
        const tkhd = buf.indexOf(Buffer.from("tkhd", "ascii"));
        expect(tkhd).toBeGreaterThan(0);
        // Width and height are the last 8 bytes of the tkhd box (16.16 fixed point).
        const boxEnd = tkhd + buf.readUInt32BE(tkhd - 4) - 4;
        expect(buf.readUInt32BE(boxEnd - 8) / 0x10000).toBe(360);
        expect(buf.readUInt32BE(boxEnd - 4) / 0x10000).toBe(360);
        expect(statSync(join(brandDir, "logo-loop.mp4")).size).toBeLessThan(200 * 1024);
    });

    it("keeps no reference to the retired lockup or 256 px icon", () => {
        const pattern = new RegExp(["logo-256", "logo-lockup", "LOGO_LOCKUP_SRC"].join("|"));
        const hits = [...walk(resolve(root, "packages")), ...walk(resolve(root, "apps"))]
            .filter(file => pattern.test(readFileSync(file, "utf8")));
        expect(hits).toEqual([]);
    });
});
