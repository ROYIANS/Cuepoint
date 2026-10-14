import {smoothstep, clamp01, type Plan, type Sets, type SceneState} from "./plan";

/** Opacity of an unlit cell's outline particles; lit cells rise from here. */
export const GRID_DIM = 0.3;
const SPLIT_END = 0.16;
const LIGHT_START = 0.2;
const LIGHT_GAP = 0.11;
const LIGHT_SPAN = 0.1;
const FADE_START = 0.92;

/** Brightness (0..1) of storyboard cell `index` at this local progress. */
export function cellLight(local: number, index: number): number {
    return smoothstep((local - (LIGHT_START + index * LIGHT_GAP)) / LIGHT_SPAN);
}

function overall(local: number): number {
    return 1 - smoothstep((local - FADE_START) / (1 - FADE_START));
}

export function planScript(local: number, sets: Sets, cellCount: number, out: Plan): void {
    out.alphaScale = overall(local);
    out.behavior = local < SPLIT_END + 0.1 ? "gather" : "form";
    if (local < SPLIT_END) {
        out.from = sets.text;
        out.to = sets.grid;
        out.t = smoothstep(local / SPLIT_END);
        return;
    }
    const {grid, gridLit, cellSize} = sets;
    for (let cell = 0; cell < cellCount; cell += 1) {
        const level = GRID_DIM + 0.55 * cellLight(local, cell);
        for (let i = cell * cellSize; i < (cell + 1) * cellSize && i < grid.a.length; i += 1) gridLit.a[i] = level;
    }
    out.from = gridLit;
    out.to = gridLit;
    out.t = 0;
}

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

// Cell hairlines, shot numbers, timecodes and the "示意" tag. Labels belong to the picture,
// which is an illustration of the storyboard idea rather than the product's interface.
export function drawScript(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const {local, layout} = s;
    if (local < SPLIT_END) return;
    const fade = overall(local);
    const small = layout.art.w < 420;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.textBaseline = "top";
    layout.cells.forEach((cell, index) => {
        const lit = cellLight(local, index) * fade;
        if (lit < 0.01) return;
        ctx.strokeStyle = `rgba(255,255,255,${0.22 * lit})`;
        ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w, cell.h);
        ctx.beginPath();
        ctx.moveTo(cell.x + cell.w * 0.08, cell.y + cell.h * 0.64);
        ctx.lineTo(cell.x + cell.w * 0.92, cell.y + cell.h * 0.64);
        ctx.strokeStyle = `rgba(255,255,255,${0.12 * lit})`;
        ctx.stroke();
        const fontSize = small ? 9 : 11;
        ctx.font = `500 ${fontSize}px ${MONO}`;
        ctx.fillStyle = `rgba(255,255,255,${0.85 * lit})`;
        ctx.textAlign = "left";
        ctx.fillText(`SC ${String(index + 1).padStart(2, "0")}`, cell.x + 8, cell.y + 8);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * lit})`;
        ctx.textAlign = "right";
        ctx.fillText(`00:00:${String(index * 4).padStart(2, "0")}:00`, cell.x + cell.w - 8, cell.y + cell.h - fontSize - 8);
    });
    const tag = clamp01((local - 0.3) / 0.1) * fade;
    if (tag > 0.01) {
        ctx.font = '500 11px "PingFang SC", "Noto Sans SC", sans-serif';
        ctx.textAlign = "right";
        ctx.fillStyle = `rgba(255,255,255,${0.5 * tag})`;
        ctx.fillText("示意", layout.art.x + layout.art.w, layout.art.y + layout.art.h + 14);
    }
    ctx.restore();
}
