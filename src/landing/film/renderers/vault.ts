import {clamp01, smoothstep, type Plan, type SceneState, type Sets, type VaultGeom, type VaultSets} from "./plan";
import {artScale, circleOutline, createSet, lineSamples, scatterSet, segmentSamples, type Rect, type TargetSet} from "./targets";

// Scene 4 (vault): a wireframe film can seen from above; material gathers into it, the lid closes,
// the lock clicks, and a small lock appears. No cloud, no upload: a few specks stay outside.
//
// Animation windows (local progress of the scene):
//   0.00-0.12  alpha eases in           0.00-0.44  particles gather from the dust into the can's rings
//   0.30-0.50  the lid closes (the gap in the outer ring shrinks to nothing)
//   0.50-0.64  the lock: a shock ring spreads and the rim flashes at 0.50-0.55
//   0.52-0.68  lock particles rise from the hub and form the padlock; outsiders are pushed outward
//   0.66-0.74  the key label fades in           0.70-0.78  the storage label fades in; picture complete
//   0.92-1.00  everything fades out

/** The picture's two captions. */
export const VAULT_KEY_LABEL = "API Key 自备";
export const VAULT_STORE_LABEL = "本机 · SQLite / IndexedDB";

const ALPHA_IN = 0.12;
const GATHER_END = 0.44;
const LID_START = 0.3;
const LID_SPAN = 0.2;
const LOCK_AT = 0.5;
const LOCK_SPAN = 0.14;
const FORM_START = 0.52;
const FORM_SPAN = 0.16;
const KEY_LABEL_START = 0.66;
const STORE_LABEL_START = 0.7;
const FADE_START = 0.92;
const LID_GAP = 0.9;
const PUSH = 1.12;

function overall(local: number): number {
    return smoothstep(local / ALPHA_IN) * (1 - smoothstep((local - FADE_START) / (1 - FADE_START)));
}

export function vaultGeometry(art: Rect): VaultGeom {
    const small = art.w < 420;
    const k = artScale(art);
    const r = Math.min(art.w * (small ? 0.34 : 0.3), art.h * 0.34);
    const cx = art.x + art.w / 2;
    const cy = art.y + art.h * 0.58;
    const lockH = Math.min(art.h * 0.2, 70 * k, cy - r - 8 - art.y);
    const bodyW = lockH * 0.72;
    const bodyH = lockH * 0.55;
    const top = cy - r - 10 - lockH;
    const labelFont = small ? 11 : Math.round(13 * k);
    return {
        cx, cy, r, font: labelFont,
        lock: {cx, top, bodyW, bodyH, shackleR: bodyW * 0.32},
        keyLabel: {x: cx + bodyW / 2 + 12, y: top + bodyW * 0.32 + bodyH * 0.45 + bodyH / 2},
        storeLabel: {x: cx, y: cy + r + 16 * k},
    };
}

function lockSegments(geom: VaultGeom): number[] {
    const {cx, top, bodyW, bodyH, shackleR} = geom.lock;
    const bodyTop = top + shackleR + (geom.lock.bodyH * 0.45);
    const x0 = cx - bodyW / 2;
    return [x0, bodyTop, x0 + bodyW, bodyTop, x0 + bodyW, bodyTop, x0 + bodyW, bodyTop + bodyH, x0 + bodyW, bodyTop + bodyH, x0, bodyTop + bodyH, x0, bodyTop + bodyH, x0, bodyTop];
}

/** Shackle: a semicircle plus its two short legs down to the body. */
function shackle(geom: VaultGeom, count: number): Float32Array {
    const {cx, top, bodyH, shackleR} = geom.lock;
    const centerY = top + shackleR;
    const legEnd = top + shackleR + bodyH * 0.45;
    const legs = Math.max(2, Math.floor(count * 0.3));
    const arc = circleOutline(cx, centerY, shackleR, count - legs, Math.PI, Math.PI);
    const left = lineSamples(cx - shackleR, centerY, cx - shackleR, legEnd, Math.floor(legs / 2));
    const right = lineSamples(cx + shackleR, centerY, cx + shackleR, legEnd, legs - Math.floor(legs / 2));
    const out = new Float32Array(count * 2);
    out.set(arc, 0);
    out.set(left, arc.length);
    out.set(right, arc.length + left.length);
    return out;
}

/** Particle budget, by fraction of the pool: two rings, hub, spokes, outsiders, lock. */
export function buildVaultSets(geom: VaultGeom, capacity: number, rng: () => number, width: number, height: number): VaultSets {
    const can = createSet(capacity);
    const lock = createSet(capacity);
    scatterSet(can, 0, rng, width, height, () => 0);
    scatterSet(lock, 0, rng, width, height, () => 0);
    const {cx, cy, r} = geom;
    let cursor = 0;
    const put = (set: TargetSet, offset: number, points: Float32Array, alpha: number): void => {
        for (let i = 0; i < points.length / 2; i += 1) {
            set.x[offset + i] = points[i * 2];
            set.y[offset + i] = points[i * 2 + 1];
            set.a[offset + i] = alpha;
        }
    };
    const both = (points: Float32Array, alpha: number): void => {
        put(can, cursor, points, alpha);
        put(lock, cursor, points, alpha);
        cursor += points.length / 2;
    };
    both(circleOutline(cx, cy, r * 0.8, Math.floor(capacity * 0.22)), 0.85);
    both(circleOutline(cx, cy, r * 0.58, Math.floor(capacity * 0.14)), 0.75);
    both(circleOutline(cx, cy, r * 0.14, Math.max(6, Math.floor(capacity * 0.05))), 1);
    const spokes: number[] = [];
    for (let k = 0; k < 3; k += 1) {
        const angle = -Math.PI / 2 + (k * Math.PI * 2) / 3;
        spokes.push(cx + Math.cos(angle) * r * 0.14, cy + Math.sin(angle) * r * 0.14, cx + Math.cos(angle) * r * 0.58, cy + Math.sin(angle) * r * 0.58);
    }
    both(segmentSamples(spokes, Math.floor(capacity * 0.06)), 0.6);
    // Outsiders: specks that come close and stay out; the lock pushes them a little farther.
    const outsiders = Math.max(6, Math.floor(capacity * 0.04));
    for (let i = 0; i < outsiders; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = r * (1.2 + rng() * 0.28);
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        for (const [set, k] of [[can, 1], [lock, PUSH]] as const) {
            set.x[cursor] = cx + (x - cx) * k;
            set.y[cursor] = cy + (y - cy) * k;
            set.a[cursor] = 0.7;
        }
        cursor += 1;
    }
    // Lock particles wait inside the hub, invisible, and rise into the padlock.
    const lockCount = Math.max(10, Math.floor(capacity * 0.09));
    const bodyPoints = Math.floor(lockCount * 0.6);
    const points = new Float32Array(lockCount * 2);
    points.set(segmentSamples(lockSegments(geom), bodyPoints), 0);
    points.set(shackle(geom, lockCount - bodyPoints), bodyPoints * 2);
    for (let i = 0; i < lockCount && cursor + i < capacity; i += 1) {
        can.x[cursor + i] = cx;
        can.y[cursor + i] = cy;
        can.a[cursor + i] = 0;
        lock.x[cursor + i] = points[i * 2];
        lock.y[cursor + i] = points[i * 2 + 1];
        lock.a[cursor + i] = 1;
    }
    return {can, lock};
}

export function planVault(local: number, sets: Sets, out: Plan): void {
    out.alphaScale = overall(local);
    const {can, lock} = sets.vault;
    if (local < GATHER_END) {
        out.from = sets.scatter;
        out.to = can;
        out.t = smoothstep(local / GATHER_END);
        out.behavior = "gather";
    } else {
        out.from = can;
        out.to = lock;
        out.t = smoothstep((local - FORM_START) / FORM_SPAN);
        out.behavior = "form";
    }
}

const FONT = '"PingFang SC", "Noto Sans SC", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

export function drawVault(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const {local, layout} = s;
    const g = layout.vault;
    const fade = overall(local);
    if (fade < 0.01) return;
    const closing = smoothstep((local - LID_START) / LID_SPAN);
    const flash = Math.max(0, 1 - Math.abs(local - (LOCK_AT + 0.02)) / 0.04);
    ctx.save();
    ctx.lineWidth = 1 + flash;
    // The rim with its lid: an opening at the top that closes.
    const gap = LID_GAP * (1 - closing);
    ctx.strokeStyle = `rgba(255,248,235,${(0.16 + 0.3 * smoothstep(local / 0.2) + 0.5 * flash) * fade})`;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.r, -Math.PI / 2 + gap / 2, (3 * Math.PI) / 2 - gap / 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Shock ring when the lock clicks (skipped on the lowest tier).
    const wave = (local - LOCK_AT) / LOCK_SPAN;
    if (s.quality !== "low" && wave > 0 && wave < 1) {
        ctx.strokeStyle = `rgba(255,248,235,${0.5 * (1 - wave) * fade})`;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.r * (1.02 + 0.5 * smoothstep(wave)), 0, Math.PI * 2);
        ctx.stroke();
    }
    if (flash > 0.01) s.glow(ctx, g.cx, g.cy, g.r * 0.5, 0.35 * flash * fade);
    ctx.font = `400 ${g.font}px ${FONT}`;
    ctx.textBaseline = "middle";
    const key = clamp01((local - KEY_LABEL_START) / 0.08) * fade;
    if (key > 0.01) {
        ctx.textAlign = "left";
        ctx.fillStyle = `rgba(255,248,235,${0.85 * key})`;
        ctx.fillText(VAULT_KEY_LABEL, g.keyLabel.x, g.keyLabel.y);
    }
    const store = clamp01((local - STORE_LABEL_START) / 0.08) * fade;
    if (store > 0.01) {
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(255,248,235,${0.6 * store})`;
        ctx.fillText(VAULT_STORE_LABEL, g.storeLabel.x, g.storeLabel.y);
    }
    ctx.restore();
}
