import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";
import {HERO_NOTE, ONLINE_NOTES, OPEN_SOURCE, PRIVACY, SCENE_COPY, type Claim} from "@/landing/content/copy";
import {FAQ} from "@/landing/content/faq";
import {SCENES} from "@/landing/film/scenes";
import {FORBIDDEN_CLAIMS} from "./fixtures/landing/forbiddenClaims";

const sceneCopy = Object.values(SCENE_COPY);
const claims: Claim[] = [
    ...sceneCopy.flatMap(copy => [copy.narration, ...copy.points, ...(copy.eyebrow ? [copy.eyebrow] : [])]),
    HERO_NOTE, ...ONLINE_NOTES, OPEN_SOURCE, PRIVACY, ...FAQ.map(item => item.answer),
];
const allText = [
    ...sceneCopy.flatMap(copy => [copy.kicker, copy.title, copy.caption]),
    ...claims.map(claim => claim.text), ...FAQ.map(item => item.question),
].join("\n");

describe("landing copy", () => {
    it("has copy for every scene and keeps it short", () => {
        expect(Object.keys(SCENE_COPY).sort()).toEqual(SCENES.map(scene => scene.id).sort());
        for (const [id, copy] of Object.entries(SCENE_COPY)) {
            expect(copy.points.length, `${id} points`).toBeLessThanOrEqual(3);
            expect(copy.title.length, `${id} title`).toBeLessThanOrEqual(16);
            expect(copy.narration.text.length, `${id} narration`).toBeLessThanOrEqual(100);
            expect(copy.caption.length, `${id} caption`).toBeLessThanOrEqual(40);
            for (const point of copy.points) expect(point.text.length, `${id} point`).toBeLessThanOrEqual(100);
        }
        expect(FAQ.length).toBeLessThanOrEqual(5);
    });

    it("backs every claim with evidence that points at real files", () => {
        expect(claims.length).toBeGreaterThan(20);
        for (const claim of claims) {
            expect(claim.evidence.trim().length, claim.text).toBeGreaterThan(5);
            for (const part of claim.evidence.split(/[；、]/)) {
                const path = /^[A-Za-z_][\w./$-]*/.exec(part.trim())?.[0];
                if (path && (path.includes("/") || /\.\w+$/.test(path) || path === "LICENSE")) {
                    expect(existsSync(resolve(process.cwd(), path)), `${path} for "${claim.text}"`).toBe(true);
                }
            }
        }
    });

    it("makes none of the claims the product does not support", () => {
        expect(FORBIDDEN_CLAIMS.filter(word => allText.includes(word))).toEqual([]);
    });

    it("labels the agent frame as an illustration and states the delivery limits honestly", () => {
        expect(SCENE_COPY.agent.schematic).toBe(true);
        expect(SCENE_COPY.agent.caption).toContain("示意");
        expect(SCENE_COPY.delivery.points.map(point => point.text).join("")).toContain("不含完整的视频时间线剪辑");
        expect(SCENE_COPY.delivery.points.map(point => point.text).join("")).toMatch(/CSV.*ZIP|ZIP.*CSV/);
    });
});
