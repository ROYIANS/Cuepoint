import {type Plan, type SceneState, type Sets, smoothstep} from "./plan";

// The leader is driven by progress (scroll or playback), never by a timer. At rest (progress 0,
// before anyone has pressed play) only the breathing point is on screen; the countdown, the burst
// and the title all belong to the progress range that follows.
const COUNT_START = 0.05;
const COUNT_STEP = 0.085;
const CUE_START = 0.31;
const CUE_SPAN = 0.14;
const DOT_FADE_START = 0.4;
const BURST = 0.46;
const DUST_END = 0.56;
const GATHER_START = 0.62;
const FORM_START = 0.68;
/** Local progress at which the title has been fully targeted; the DOM text layer waits for it (see landing.css). */
export const TITLE_FORMED = 0.74;

/** Below this local progress the leader is at rest: the point breathes and nothing else is on screen. */
export const LEADER_REST = COUNT_START;

export function planLeader(local: number, sets: Sets, out: Plan): void {
    out.alphaScale = 1;
    out.behavior = "scatter";
    if (local < BURST) {
        out.from = sets.center;
        out.to = sets.center;
        out.t = 0;
    } else if (local < DUST_END) {
        out.from = sets.center;
        out.to = sets.scatter;
        out.t = smoothstep((local - BURST) / (DUST_END - BURST));
    } else if (local < GATHER_START) {
        out.from = sets.scatter;
        out.to = sets.scatter;
        out.t = 0;
    } else {
        out.from = sets.scatter;
        out.to = sets.title;
        out.t = smoothstep((local - GATHER_START) / (TITLE_FORMED - GATHER_START));
        out.behavior = local < FORM_START ? "gather" : "form";
    }
}

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

// Leader chart: a breathing point, hairlines, a 3-2-1 ring and the cue mark.
export function drawLeader(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const {local, t} = s;
    const {w, h} = s.layout;
    const cx = w / 2;
    const cy = h / 2;
    const unit = Math.min(w, h);
    const intro = smoothstep(t / 1400);
    const breath = 1 + 0.14 * Math.sin(t / 540);
    const burst = smoothstep((local - DOT_FADE_START) / 0.08);
    const guide = intro * (1 - burst);
    // Guide hairlines and registration rings.
    if (guide > 0.01) {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.07 * guide})`;
        ctx.beginPath();
        ctx.moveTo(0, cy + 0.5);
        ctx.lineTo(w, cy + 0.5);
        ctx.moveTo(cx + 0.5, 0);
        ctx.lineTo(cx + 0.5, h);
        ctx.stroke();
        for (const r of [unit * 0.11, unit * 0.19]) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
    // The point itself.
    const dotAlpha = intro * (1 - burst);
    if (dotAlpha > 0.01) s.glow(ctx, cx, cy, unit * 0.05 * breath * (1 + burst * 1.4), dotAlpha);
    // Countdown ring with its digit.
    const countLocal = (local - COUNT_START) / COUNT_STEP;
    if (countLocal >= 0 && countLocal < 3) {
        const digit = 3 - Math.floor(countLocal);
        const u = countLocal - Math.floor(countLocal);
        const radius = unit * (0.15 - 0.045 * smoothstep(u));
        const alpha = Math.sin(Math.PI * Math.min(1, u * 1.05)) * 0.75 * (1 - burst);
        ctx.save();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - u * 0.85));
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = `400 ${Math.round(unit * 0.034)}px ${MONO}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(digit), cx, cy + unit * 0.215);
        ctx.restore();
    }
    // Cue mark: ring, cross and label, flashing twice.
    const cue = (local - CUE_START) / CUE_SPAN;
    if (cue > 0 && cue < 1) {
        const flash = 0.45 + 0.55 * Math.max(0, Math.sin(cue * Math.PI * 2.2) ** 2);
        const alpha = Math.sin(Math.PI * cue) * flash * 0.85 * (1 - burst);
        const mx = cx + unit * 0.2;
        const my = cy - unit * 0.17;
        ctx.save();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(mx, my, 9, 0, Math.PI * 2);
        ctx.moveTo(mx - 15, my);
        ctx.lineTo(mx + 15, my);
        ctx.moveTo(mx, my - 15);
        ctx.lineTo(mx, my + 15);
        ctx.stroke();
        ctx.font = `500 11px ${MONO}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("C U E", mx + 24, my);
        ctx.restore();
    }
}
