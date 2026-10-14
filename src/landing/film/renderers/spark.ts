import {smoothstep, clamp01, type Plan, type Sets, type SceneState} from "./plan";

/**
 * Illustrative lines for the screenplay in dots. It is an invented, wordless
 * mood piece, not a claim about the product (those live in content/copy.ts).
 */
export const SPARK_LINES: readonly string[] = ["内景 · 书房 · 夜", "灯亮了。", "她写下第一行字。"];

const GATHER_END = 0.16;
const TYPE_SPAN = 0.62;

/** How many text points are revealed at this local progress. */
export function revealCount(local: number, textCount: number): number {
    return Math.floor(clamp01((local - GATHER_END) / TYPE_SPAN) * textCount);
}

/** Composes `typed`: a revealed prefix of the text, the rest as faint dust. */
function composeTyped(sets: Sets, count: number): void {
    if (sets.typedCount === count) return;
    sets.typedCount = count;
    const {text, scatter, typed} = sets;
    for (let i = 0; i < typed.x.length; i += 1) {
        const on = i < count;
        typed.x[i] = on ? text.x[i] : scatter.x[i];
        typed.y[i] = on ? text.y[i] : scatter.y[i];
        typed.a[i] = on ? 1 : scatter.a[i] * 0.55;
    }
}

export function planSpark(local: number, sets: Sets, out: Plan): void {
    out.alphaScale = 1;
    out.behavior = "gather";
    if (local < GATHER_END) {
        out.from = sets.title;
        out.to = sets.scatter;
        out.t = smoothstep(local / GATHER_END);
        out.behavior = "scatter";
        return;
    }
    composeTyped(sets, revealCount(local, sets.textCount));
    out.from = sets.typed;
    out.to = sets.typed;
    out.t = 0;
}

// The caret rides the last revealed point and blinks.
export function drawSpark(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const {local, sets, pool, t} = s;
    if (local < GATHER_END || sets.textCount === 0) return;
    const shown = revealCount(local, sets.textCount);
    const last = Math.max(0, Math.min(sets.textCount - 1, shown - 1));
    const typing = shown < sets.textCount;
    // Blinks only while typing (frames are running anyway); a settled caret stays lit, since a still page runs no frames.
    if (typing && Math.floor(t / 530) % 2 === 1) return;
    const height = sets.textSize * 1.25;
    ctx.save();
    ctx.fillStyle = "rgba(255,248,235,0.85)";
    ctx.fillRect(pool.tx[last] + 10, pool.ty[last] - height / 2, 2, height);
    ctx.restore();
}
