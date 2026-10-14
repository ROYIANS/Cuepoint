import {clamp01, smoothstep, type DeliveryGeom, type DeliverySets, type Plan, type SceneState, type Sets} from "./plan";
import {artScale, createSet, rectSegments, scatterSet, segmentSamples, type Rect} from "./targets";

// Scene 5 (delivery): a film strip splits into three, and each third folds into a file: a project
// ZIP, a storyboard CSV and a printable storyboard page. Only deliverables the product really
// makes (see README "检查交付" and "项目 ZIP 的范围"); no video file.
//
// Animation windows (local progress of the scene):
//   0.00-0.14  alpha eases in; particles gather from the dust into the strip
//   0.26-0.41  the left third lifts off and becomes the ZIP icon (label fades in at the end)
//   0.41-0.56  the middle third becomes the CSV table
//   0.56-0.71  the right third becomes the storyboard page; all three lit, picture complete
//   0.92-1.00  everything fades out
// Within a third the points leave in a stagger (left to right), so the strip unfolds instead of sliding.

export const DELIVERY_FILES: readonly {readonly label: string}[] = [{label: "项目 ZIP"}, {label: "分镜 CSV"}, {label: "分镜板"}];

const ALPHA_IN = 0.1;
const ENTER_END = 0.14;
const GROUP_START: readonly number[] = [0.26, 0.41, 0.56];
const GROUP_SPAN = 0.15;
const FADE_START = 0.92;
const STRIP_FRAMES = 4;

/** 0..1 progress of file `index` (strip third to icon). */
export function fileProgress(local: number, index: number): number {
    return clamp01((local - GROUP_START[index]) / GROUP_SPAN);
}

function overall(local: number): number {
    return smoothstep(local / ALPHA_IN) * (1 - smoothstep((local - FADE_START) / (1 - FADE_START)));
}

export function deliveryGeometry(art: Rect): DeliveryGeom {
    const small = art.w < 420;
    const stripH = Math.max(36, art.h * 0.2);
    const strip = {x: art.x, y: art.y + art.h * 0.02, w: art.w, h: stripH};
    const gap = art.w * 0.05;
    const column = (art.w - gap * 2) / 3;
    const k = artScale(art);
    const iconH = art.h * 0.5;
    const iconW = Math.min(column, iconH * 0.8);
    const iconTop = art.y + art.h * 0.4;
    const icons = [0, 1, 2].map(index => ({x: art.x + index * (column + gap) + (column - iconW) / 2, y: iconTop, w: iconW, h: iconH}));
    return {strip, icons, labelY: iconTop + iconH + (small ? 14 : 18 * k), font: small ? 11 : Math.round(13 * k)};
}

function stripSegments(strip: Rect): number[] {
    const segments = rectSegments(strip);
    const hole = strip.h * 0.1;
    const pitch = strip.h * 0.3;
    for (let x = strip.x + pitch * 0.6; x + hole < strip.x + strip.w; x += pitch) {
        segments.push(x, strip.y + strip.h * 0.12, x + hole, strip.y + strip.h * 0.12);
        segments.push(x, strip.y + strip.h * 0.88, x + hole, strip.y + strip.h * 0.88);
    }
    const inner = strip.w / STRIP_FRAMES;
    for (let frame = 0; frame < STRIP_FRAMES; frame += 1) {
        segments.push(...rectSegments({x: strip.x + frame * inner + inner * 0.1, y: strip.y + strip.h * 0.24, w: inner * 0.8, h: strip.h * 0.52}));
    }
    return segments;
}

/** The ZIP icon: a page with a zipper down the middle and its pull tab. */
function zipSegments(r: Rect): number[] {
    const segments = rectSegments(r);
    const cx = r.x + r.w / 2;
    const tooth = r.w * 0.14;
    const rows = 9;
    const reach = r.h * 0.62;
    segments.push(cx, r.y, cx, r.y + reach);
    for (let i = 0; i < rows; i += 1) {
        const y = r.y + (reach * (i + 0.5)) / rows;
        const side = i % 2 === 0 ? -1 : 1;
        segments.push(cx, y, cx + side * tooth, y);
    }
    segments.push(...rectSegments({x: cx - r.w * 0.09, y: r.y + reach, w: r.w * 0.18, h: r.h * 0.14}));
    return segments;
}

/** The CSV icon: a page cut into a table. */
function csvSegments(r: Rect): number[] {
    const segments = rectSegments(r);
    for (const f of [0.22, 0.44, 0.66, 0.84]) segments.push(r.x, r.y + r.h * f, r.x + r.w, r.y + r.h * f);
    for (const f of [1 / 3, 2 / 3]) segments.push(r.x + r.w * f, r.y, r.x + r.w * f, r.y + r.h);
    return segments;
}

/** The storyboard page: a sheet with four frames and two lines of notes. */
function boardSegments(r: Rect): number[] {
    const segments = rectSegments(r);
    const cellW = r.w * 0.38;
    const cellH = r.h * 0.26;
    for (const row of [0.1, 0.42]) {
        for (const col of [0.08, 0.54]) segments.push(...rectSegments({x: r.x + r.w * col, y: r.y + r.h * row, w: cellW, h: cellH}));
    }
    for (const f of [0.78, 0.88]) segments.push(r.x + r.w * 0.08, r.y + r.h * f, r.x + r.w * (f === 0.78 ? 0.9 : 0.62), r.y + r.h * f);
    return segments;
}

/** Particle budget: 62% of the pool forms the strip, split by x into three groups that each become an icon. */
export function buildDeliverySets(geom: DeliveryGeom, capacity: number, rng: () => number, width: number, height: number): DeliverySets {
    const strip = createSet(capacity);
    const files = createSet(capacity);
    const live = createSet(capacity);
    for (const set of [strip, files, live]) scatterSet(set, 0, rng, width, height, () => 0);
    const total = Math.floor(capacity * 0.62);
    const points = segmentSamples(stripSegments(geom.strip), total);
    const x0 = geom.strip.x;
    const third = geom.strip.w / 3;
    const groups = [0, 0, 0, 0];
    const order: number[][] = [[], [], []];
    for (let i = 0; i < total; i += 1) order[Math.min(2, Math.max(0, Math.floor((points[i * 2] - x0) / third)))].push(i);
    const shapes = [zipSegments, csvSegments, boardSegments];
    let cursor = 0;
    order.forEach((indices, group) => {
        groups[group] = cursor;
        const icon = segmentSamples(shapes[group](geom.icons[group]), indices.length);
        indices.forEach((from, k) => {
            const to = cursor + k;
            strip.x[to] = points[from * 2];
            strip.y[to] = points[from * 2 + 1];
            strip.a[to] = 1;
            files.x[to] = icon[k * 2];
            files.y[to] = icon[k * 2 + 1];
            files.a[to] = 1;
        });
        cursor += indices.length;
    });
    groups[3] = cursor;
    live.x.set(strip.x);
    live.y.set(strip.y);
    live.a.set(strip.a);
    return {strip, files, live, groups};
}

export function planDelivery(local: number, sets: Sets, geom: DeliveryGeom, out: Plan): void {
    out.alphaScale = overall(local);
    const d = sets.delivery;
    if (local < ENTER_END) {
        out.from = sets.scatter;
        out.to = d.strip;
        out.t = smoothstep(local / ENTER_END);
        out.behavior = "gather";
        return;
    }
    const lift = geom.strip.h * 0.9;
    const {strip, files, live, groups} = d;
    for (let group = 0; group < 3; group += 1) {
        const progress = fileProgress(local, group);
        const begin = groups[group];
        const size = Math.max(1, groups[group + 1] - begin);
        for (let i = begin; i < groups[group + 1]; i += 1) {
            const e = smoothstep(progress * 1.6 - (0.6 * (i - begin)) / size);
            live.x[i] = strip.x[i] + (files.x[i] - strip.x[i]) * e;
            live.y[i] = strip.y[i] + (files.y[i] - strip.y[i]) * e - Math.sin(Math.PI * e) * lift;
        }
    }
    out.from = live;
    out.to = live;
    out.t = 0;
    out.behavior = "form";
}

const FONT = '"PingFang SC", "Noto Sans SC", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

export function drawDelivery(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const {local, layout} = s;
    const g = layout.delivery;
    const fade = overall(local);
    if (fade < 0.01 || local < ENTER_END) return;
    ctx.save();
    ctx.font = `400 ${g.font}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    DELIVERY_FILES.forEach((file, index) => {
        const arrive = smoothstep((fileProgress(local, index) - 0.55) / 0.45) * fade;
        if (arrive < 0.01) return;
        const icon = g.icons[index];
        const cx = icon.x + icon.w / 2;
        if (s.quality !== "low") s.glow(ctx, cx, icon.y + icon.h / 2, icon.h * 0.55, 0.12 * arrive);
        ctx.fillStyle = `rgba(255,248,235,${0.85 * arrive})`;
        ctx.fillText(file.label, cx, g.labelY);
        if (index === 1) {
            // The commas of the CSV: one per column break on its header row.
            ctx.font = `500 ${g.font + 3}px ${FONT}`;
            ctx.fillStyle = `rgba(255,248,235,${0.7 * arrive})`;
            for (const f of [1 / 3, 2 / 3]) ctx.fillText(",", icon.x + icon.w * f - icon.w / 6, icon.y + icon.h * 0.11);
            ctx.font = `400 ${g.font}px ${FONT}`;
        }
    });
    ctx.restore();
}
