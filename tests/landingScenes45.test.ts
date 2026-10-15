import {describe, expect, it} from "vitest";
import {FORBIDDEN_CLAIMS} from "./fixtures/landing/forbiddenClaims";
import {SCENE_COPY} from "../apps/site/src/content/copy";
import {agentGeometry, AGENT_APPROVED, AGENT_PENDING, AGENT_ROWS, AGENT_SCHEMATIC, buildAgentSets, drawAgent, planAgent, ROW_START, rowLight} from "../apps/site/src/film/renderers/agent";
import {buildDeliverySets, DELIVERY_FILES, deliveryGeometry, drawDelivery, fileProgress, planDelivery} from "../apps/site/src/film/renderers/delivery";
import {buildVaultSets, drawVault, planVault, vaultGeometry, VAULT_KEY_LABEL, VAULT_STORE_LABEL} from "../apps/site/src/film/renderers/vault";
import {createPool, MAX_PARTICLES, mulberry32, type Quality} from "../apps/site/src/film/renderers/particles";
import type {Layout, Plan, SceneState, Sets} from "../apps/site/src/film/renderers/plan";
import {artRect, circleOutline, createSet, lineSamples, rectOutline, rectSegments, segmentSamples, type TargetSet} from "../apps/site/src/film/renderers/targets";
import {SCENE_BEATS} from "../apps/site/src/film/playback";

const QUALITIES: readonly Quality[] = ["high", "medium", "low"];
const SIZES: readonly [number, number][] = [[1280, 800], [390, 844]];

function recordingContext() {
    const texts: string[] = [];
    const counts = {arc: 0, stroke: 0};
    const noop = () => undefined;
    const ctx = {
        font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "", textBaseline: "", globalAlpha: 1,
        save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, fillRect: noop,
        arc: () => { counts.arc += 1; }, stroke: () => { counts.stroke += 1; },
        fillText: (text: string) => { texts.push(text); },
        measureText: (text: string) => ({width: text.length * 7}),
    };
    return {ctx: ctx as unknown as CanvasRenderingContext2D, texts, counts};
}

function scene(width: number, height: number, quality: Quality) {
    const art = artRect(width, height);
    const layout = {w: width, h: height, art, cells: [], agent: agentGeometry(art), vault: vaultGeometry(art), delivery: deliveryGeometry(art)} as unknown as Layout;
    const capacity = MAX_PARTICLES[quality];
    const rng = mulberry32(7);
    const filler = (): TargetSet => createSet(capacity);
    const sets = {
        center: filler(), scatter: filler(), title: filler(), text: filler(), typed: filler(), grid: filler(), gridLit: filler(), textCount: 0, textSize: 20, cellSize: 1, typedCount: -1,
        agent: buildAgentSets(layout.agent, capacity, rng, width, height),
        vault: buildVaultSets(layout.vault, capacity, rng, width, height),
        delivery: buildDeliverySets(layout.delivery, capacity, rng, width, height),
    } as Sets;
    return {layout, sets, art, capacity};
}

function state(width: number, height: number, quality: Quality, local: number) {
    const base = scene(width, height, quality);
    const {ctx, texts, counts} = recordingContext();
    const scene3: SceneState = {layout: base.layout, sets: base.sets, pool: createPool(base.capacity, 3), quality, local, t: 0, glow: () => undefined};
    return {state: scene3, texts, counts, ctx};
}

const blank = (sets: Sets): Plan => ({from: sets.center, to: sets.center, t: 0, behavior: "scatter", alphaScale: 0});

describe("target helpers", () => {
    it("samples segments by length, deterministically", () => {
        const rect = {x: 10, y: 20, w: 100, h: 50};
        const a = segmentSamples(rectSegments(rect), 60);
        expect(Array.from(a)).toEqual(Array.from(segmentSamples(rectSegments(rect), 60)));
        expect(a).toHaveLength(120);
        for (let i = 0; i < 60; i += 1) {
            expect(a[i * 2]).toBeGreaterThanOrEqual(10 - 1e-4);
            expect(a[i * 2]).toBeLessThanOrEqual(110 + 1e-4);
            expect(a[i * 2 + 1]).toBeGreaterThanOrEqual(20 - 1e-4);
            expect(a[i * 2 + 1]).toBeLessThanOrEqual(70 + 1e-4);
        }
        expect(segmentSamples([], 5)).toHaveLength(10);
        expect(segmentSamples([0, 0, 1, 1], 0)).toHaveLength(0);
    });

    it("spreads dashes proportionally and lines evenly", () => {
        expect(Array.from(lineSamples(0, 0, 100, 0, 4))).toEqual([12.5, 0, 37.5, 0, 62.5, 0, 87.5, 0]);
        const dashes = segmentSamples([0, 0, 10, 0, 50, 0, 60, 0], 10);
        for (let i = 0; i < 10; i += 1) expect(dashes[i * 2] <= 10 || dashes[i * 2] >= 50).toBe(true);
    });

    it("places circle and arc points on the radius", () => {
        const ring = circleOutline(50, 60, 30, 24);
        for (let i = 0; i < 24; i += 1) expect(Math.hypot(ring[i * 2] - 50, ring[i * 2 + 1] - 60)).toBeCloseTo(30, 3);
        const arc = circleOutline(0, 0, 10, 8, Math.PI, Math.PI);
        for (let i = 0; i < 8; i += 1) expect(arc[i * 2 + 1]).toBeLessThanOrEqual(1e-4); // upper half: y grows down
        expect(rectOutline({x: 0, y: 0, w: 10, h: 10}, 4)).toHaveLength(8);
    });
});

describe.each(SIZES)("scenes 3-5 at %ix%i", (width, height) => {
    describe.each(QUALITIES)("%s quality", quality => {
        const {sets, art, capacity, layout} = scene(width, height, quality);

        it("keeps every set within the pool and every visible point near the art rectangle", () => {
            const margin = Math.max(art.w, art.h) * 0.45;
            const inside = (set: TargetSet, count: number) => {
                for (let i = 0; i < count; i += 1) {
                    if (set.a[i] <= 0) continue;
                    expect(set.x[i]).toBeGreaterThanOrEqual(art.x - margin);
                    expect(set.x[i]).toBeLessThanOrEqual(art.x + art.w + margin);
                    expect(set.y[i]).toBeGreaterThanOrEqual(art.y - margin);
                    expect(set.y[i]).toBeLessThanOrEqual(art.y + art.h + margin);
                }
            };
            const a = sets.agent;
            const used = a.sepStart + 5 * a.sepCount;
            expect(used).toBeLessThanOrEqual(capacity);
            for (const set of [a.base, a.live, sets.vault.can, sets.vault.lock, sets.delivery.strip, sets.delivery.files, sets.delivery.live]) expect(set.x).toHaveLength(capacity);
            inside(a.base, used);
            inside(sets.vault.can, capacity);
            inside(sets.vault.lock, capacity);
            inside(sets.delivery.strip, capacity);
            inside(sets.delivery.files, capacity);
            expect(sets.delivery.groups[3]).toBeLessThanOrEqual(capacity);
            expect(sets.delivery.groups).toEqual([...sets.delivery.groups].sort((x, y) => x - y));
        });

        it("builds the same sets for the same seed", () => {
            const again = scene(width, height, quality);
            expect(Array.from(again.sets.vault.lock.x.slice(0, 80))).toEqual(Array.from(sets.vault.lock.x.slice(0, 80)));
            expect(Array.from(again.sets.agent.base.y.slice(0, 80))).toEqual(Array.from(sets.agent.base.y.slice(0, 80)));
            expect(Array.from(again.sets.delivery.files.x.slice(0, 80))).toEqual(Array.from(sets.delivery.files.x.slice(0, 80)));
        });

        it("agent: arrives from the grid, lights rows in order, fades out", () => {
            const plan = blank(sets);
            planAgent(0.05, sets, layout.agent, plan);
            expect([plan.from, plan.to]).toEqual([sets.gridLit, sets.agent.live]);
            expect(plan.t).toBeGreaterThan(0);
            expect(plan.alphaScale).toBeGreaterThan(0);
            planAgent(0, sets, layout.agent, plan);
            expect(plan.alphaScale).toBe(0);
            planAgent(0.5, sets, layout.agent, plan);
            expect([plan.from, plan.to, plan.t]).toEqual([sets.agent.live, sets.agent.live, 0]);
            expect(plan.alphaScale).toBe(1);
            const {nodeK, live} = sets.agent;
            expect(live.a[0]).toBeGreaterThan(live.a[4 * nodeK]); // row 0 lit, row 4 still dim
            planAgent(0.8, sets, layout.agent, plan);
            for (let row = 1; row < 6; row += 1) expect(live.a[row * nodeK]).toBeCloseTo(live.a[0], 5);
            planAgent(0.999, sets, layout.agent, plan);
            expect(plan.alphaScale).toBeLessThan(0.01);
            for (let i = 1; i < ROW_START.length; i += 1) expect(ROW_START[i]).toBeGreaterThan(ROW_START[i - 1]);
            expect(rowLight(0.3, 0)).toBe(1);
            expect(rowLight(0.3, 3)).toBe(0);
        });

        it("agent: flow dots stay on the guide line, inside its lit part", () => {
            const plan = blank(sets);
            planAgent(0.6, sets, layout.agent, plan);
            const {live, flowStart, flowCount} = sets.agent;
            for (let j = 0; j < flowCount; j += 1) {
                expect(live.x[flowStart + j]).toBeCloseTo(layout.agent.lineX, 3);
                expect(live.y[flowStart + j]).toBeGreaterThanOrEqual(layout.agent.top - 1e-3);
                expect(live.y[flowStart + j]).toBeLessThanOrEqual(layout.agent.bottom + 1e-3);
            }
            planAgent(0.05, sets, layout.agent, plan);
            for (let j = 0; j < flowCount; j += 1) expect(live.a[flowStart + j]).toBe(0);
        });

        it("vault: gathers from the dust, rests, then forms the lock", () => {
            const plan = blank(sets);
            planVault(0.1, sets, plan);
            expect([plan.from, plan.to]).toEqual([sets.scatter, sets.vault.can]);
            expect(plan.t).toBeGreaterThan(0);
            planVault(0.47, sets, plan);
            expect([plan.from, plan.to, plan.t]).toEqual([sets.vault.can, sets.vault.lock, 0]);
            planVault(0.6, sets, plan);
            expect(plan.t).toBeGreaterThan(0);
            expect(plan.t).toBeLessThan(1);
            planVault(0.8, sets, plan);
            expect(plan.t).toBe(1);
            planVault(0.999, sets, plan);
            expect(plan.alphaScale).toBeLessThan(0.01);
        });

        it("delivery: strip gathers, then each third becomes its file in turn", () => {
            const plan = blank(sets);
            planDelivery(0.07, sets, layout.delivery, plan);
            expect([plan.from, plan.to]).toEqual([sets.scatter, sets.delivery.strip]);
            const {strip, files, live, groups} = sets.delivery;
            planDelivery(0.2, sets, layout.delivery, plan);
            expect(plan.from).toBe(live);
            expect(live.x[0]).toBe(strip.x[0]);
            planDelivery(0.8, sets, layout.delivery, plan);
            for (const i of [0, groups[1], groups[2], groups[3] - 1]) {
                expect(live.x[i]).toBeCloseTo(files.x[i], 3);
                expect(live.y[i]).toBeCloseTo(files.y[i], 3);
            }
            expect(fileProgress(0.3, 0)).toBeGreaterThan(0);
            expect(fileProgress(0.3, 1)).toBe(0);
            expect(fileProgress(0.7, 2)).toBeLessThan(1);
            expect(fileProgress(0.72, 2)).toBe(1);
        });
    });
});

describe("drawing", () => {
    const locals = [0, 0.05, 0.1, 0.25, 0.4, 0.5, 0.6, 0.7, 0.78, 0.95, 1];
    const allText = (fn: typeof drawAgent, width: number, height: number, quality: Quality) => {
        const out = new Set<string>();
        for (const local of locals) {
            const s = state(width, height, quality, local);
            fn(s.ctx, s.state);
            s.texts.forEach(text => out.add(text));
        }
        return out;
    };

    it.each(QUALITIES)("draws every scene at every sampled progress without throwing (%s)", quality => {
        for (const [w, h] of SIZES) for (const fn of [drawAgent, drawVault, drawDelivery]) allText(fn, w, h, quality);
    });

    it("agent: shows the quiet log, the approval step and the 示意 tag, with no forbidden claim", () => {
        const texts = allText(drawAgent, 1280, 800, "high");
        const joined = [...texts].join("|");
        expect(joined).toContain("读取 项目资料");
        expect(joined).toContain("本次已保存：镜头 1 项");
        expect(joined).toContain(AGENT_PENDING);
        expect(joined).toContain(AGENT_APPROVED);
        expect(texts.has(AGENT_SCHEMATIC)).toBe(true);
        expect(SCENE_COPY.agent.caption).toContain(AGENT_SCHEMATIC);
        for (const word of FORBIDDEN_CLAIMS) expect(joined).not.toContain(word);
        // The summary row counts the tools above it.
        expect(AGENT_ROWS.filter(row => row.kind === "tool" || row.kind === "approval")).toHaveLength(3);
        expect(AGENT_ROWS[5].text).toBe("用了 3 个工具");
    });

    it("agent: low quality skips the halo pulses", () => {
        const high = state(1280, 800, "high", ROW_START[1] + 0.02);
        const low = state(1280, 800, "low", ROW_START[1] + 0.02);
        drawAgent(high.ctx, high.state);
        drawAgent(low.ctx, low.state);
        expect(high.counts.arc).toBeGreaterThan(0);
        expect(low.counts.arc).toBe(0);
    });

    it("vault: names the key and the storage honestly, and draws no cloud", () => {
        const texts = allText(drawVault, 1280, 800, "high");
        expect(texts).toEqual(new Set([VAULT_KEY_LABEL, VAULT_STORE_LABEL]));
        const copy = JSON.stringify(SCENE_COPY.vault);
        expect(copy).toContain("API Key");
        expect(copy).toContain("SQLite");
        expect(copy).toContain("IndexedDB");
        for (const word of [...FORBIDDEN_CLAIMS, "云", "上传"]) expect([...texts].join("")).not.toContain(word);
        const low = state(1280, 800, "low", 0.55);
        drawVault(low.ctx, low.state);
        expect(low.counts.arc).toBe(1); // the rim only: no shock ring on the lowest tier
        const high = state(1280, 800, "high", 0.55);
        drawVault(high.ctx, high.state);
        expect(high.counts.arc).toBe(2);
    });

    it("delivery: labels are real deliverables named in the copy, and no video file appears", () => {
        const texts = allText(drawDelivery, 1280, 800, "high");
        const copy = SCENE_COPY.delivery.points.map(point => point.text).join("");
        for (const {label} of DELIVERY_FILES) {
            expect(texts.has(label)).toBe(true);
            expect(copy).toContain(label);
        }
        const joined = [...texts].join("");
        for (const word of [...FORBIDDEN_CLAIMS, "MP4", "成片文件", "视频"]) expect(joined).not.toContain(word);
    });
});

describe("pacing of scenes 3-5", () => {
    it("holds each picture only after it is complete, inside the text layer's opaque window", () => {
        const byId = Object.fromEntries(SCENE_BEATS.map(beat => [beat.id, beat]));
        expect(byId.agent.holdLocal).toBeGreaterThan(ROW_START[5] + 0.07 - 1e-9);
        expect(byId.vault.holdLocal).toBeGreaterThanOrEqual(0.78);
        expect(byId.delivery.holdLocal).toBeGreaterThan(0.56 + 0.15);
        for (const id of ["agent", "vault", "delivery"]) {
            expect(byId[id].holdLocal).toBeLessThanOrEqual(0.84);
            expect(byId[id].holdSeconds).toBeGreaterThanOrEqual(3);
            expect(byId[id].holdSeconds).toBeLessThanOrEqual(3.2);
        }
    });
});
