import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

const read = (path: string) => readFileSync(new URL(`../packages/studio/src/${path}`, import.meta.url), "utf8");

describe("selected-state style (R9) and tool rows (R12)", () => {
    it("selected rows use the shared tint token, never a side bar", () => {
        const css = read("features/agent/ui/agentChat.css");
        const block = css.match(/\.agent-model-row\.is-selected\s*\{[^}]*\}/)?.[0] ?? "";
        expect(block).toContain("var(--surface-selected)");
        expect(block).not.toMatch(/border-(left|inline-start)|inset\s+\d+px\s+0/);
        expect(read("ui/theme.css")).toContain("--surface-selected:");
    });

    it("no selected/active selector in studio CSS draws an inset or left-border accent", () => {
        for (const file of ["features/agent/ui/agentChat.css", "features/agent/ui/executionActivity.css", "ui/theme.css"]) {
            for (const [, selector, body] of read(file).matchAll(/([^{}]*(?:is-selected|is-active|aria-current|aria-selected|data-active)[^{}]*)\{([^}]*)\}/g)) {
                expect(`${selector}{${body}}`, file).not.toMatch(/border-(left|inline-start)|box-shadow:\s*inset\s+-?\d+px\s+0/);
            }
        }
    });

    it("tool verbs are muted via tokens and regain emphasis on hover/approval", () => {
        const css = read("features/agent/ui/executionActivity.css");
        expect(css).toMatch(/\.agent-tool-verb\s*\{\s*color:\s*var\(--foreground-secondary/);
        expect(css).toContain('[data-status="awaiting_approval"] .agent-tool-verb');
    });
});
