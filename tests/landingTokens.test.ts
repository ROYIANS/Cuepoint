import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

const appCss = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const landingCss = readFileSync(new URL("../src/landing/styles/landing.css", import.meta.url), "utf8");

const TOKENS = [
    "--radius", "--surface-app", "--surface-panel", "--surface-elevated", "--background", "--foreground",
    "--primary", "--primary-foreground", "--muted-foreground", "--border", "--ring", "--font-sans", "--font-display",
];

function tokenValue(css: string, name: string): string | undefined {
    const match = new RegExp(`(?<![\\w-])${name}\\s*:\\s*([^;]+);`).exec(css);
    return match?.[1].replace(/\s+/g, " ").trim();
}

function tokenMismatches(app: string, landing: string): string[] {
    return TOKENS.filter(name => {
        const expected = tokenValue(app, name);
        return expected === undefined || tokenValue(landing, name) !== expected;
    });
}

describe("landing design tokens", () => {
    it("mirror the application's token values", () => {
        for (const name of TOKENS) expect(tokenValue(appCss, name), `${name} in styles.css`).toBeDefined();
        expect(tokenMismatches(appCss, landingCss)).toEqual([]);
    });

    it("detects drift in a changed token, a missing token and a changed font stack", () => {
        expect(tokenMismatches(appCss, landingCss.replace("--surface-app: #101010", "--surface-app: #111111"))).toEqual(["--surface-app"]);
        expect(tokenMismatches(appCss, landingCss.replace("--radius: 0.75rem;", ""))).toEqual(["--radius"]);
        expect(tokenMismatches(appCss, landingCss.replace('"Songti SC"', '"SimSun"'))).toEqual(["--font-display"]);
    });

    it("does not pull in Tailwind", () => {
        expect(landingCss).not.toMatch(/@import|@apply|@theme/);
    });
});
