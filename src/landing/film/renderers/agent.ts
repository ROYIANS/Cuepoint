import {clamp01, smoothstep, type AgentGeom, type AgentSets, type Plan, type SceneState, type Sets} from "./plan";
import {circleOutline, createSet, lineSamples, scatterSet, type Rect, type TargetSet} from "./targets";

// Scene 3 (agent): a quiet execution log, drawn as an illustration. A thin vertical line, nodes that
// light one after another, a mono label per node. The words are invented sample content in the
// product's own vocabulary (see agent-activity-ui "Quiet transcript"), and the frame is tagged 示意.
//
// Animation windows (local progress of the scene):
//   0.00-0.14  particles arrive from the storyboard grid (alpha eases in over 0.00-0.10)
//   0.12-0.19  row 0 (the user's message)         0.22-0.29  row 1 (read project material)
//   0.32-0.39  row 2 (read storyboard)            0.42-0.49  row 3 (update shot 3), waiting for approval
//   0.56-0.62  the approval lands: row 3 turns into its done state
//   0.62-0.69  row 4 (saved)                      0.70-0.77  row 5 (summary); the picture is complete
//   0.92-1.00  everything fades out
// Flow dots travel down the line as long as it is lit; their positions come from the scene's
// progress, so they move while the film moves and rest on the hold.

type AgentRow = {readonly text: string; readonly kind: "user" | "tool" | "approval" | "saved" | "summary"};

/** Sample content of the log. Everything the picture says is in this table and the three tags below. */
export const AGENT_ROWS: readonly AgentRow[] = [
    {text: "你  把第 3 场改成雨夜", kind: "user"},
    {text: "读取 项目资料", kind: "tool"},
    {text: "读取 分镜", kind: "tool"},
    {text: "更新 镜头 3", kind: "approval"},
    {text: "本次已保存：镜头 1 项", kind: "saved"},
    {text: "用了 3 个工具", kind: "summary"},
];
export const AGENT_PENDING = "待批准";
export const AGENT_APPROVED = "已批准";
export const AGENT_SCHEMATIC = "示意";

export const ROW_START: readonly number[] = [0.12, 0.22, 0.32, 0.42, 0.62, 0.7];
const ROW_SPAN = 0.07;
const ENTER_END = 0.14;
const ALPHA_IN = 0.1;
const APPROVE_AT = 0.56;
const APPROVE_SPAN = 0.06;
const FADE_START = 0.92;
const FLOW_LOOPS = 3;
const ROWS = AGENT_ROWS.length;
const APPROVAL_ROW = 3;
const NODE_DIM = 0.18;

/** Brightness (0..1) of a row at this local progress. */
export function rowLight(local: number, index: number): number {
    return smoothstep((local - ROW_START[index]) / ROW_SPAN);
}

function overall(local: number): number {
    return smoothstep(local / ALPHA_IN) * (1 - smoothstep((local - FADE_START) / (1 - FADE_START)));
}

export function agentGeometry(art: Rect): AgentGeom {
    const small = art.w < 420;
    const gap = Math.min(art.h / 5.6, 58);
    const top = art.y + (art.h - gap * (ROWS - 1)) / 2;
    const rowY = Array.from({length: ROWS}, (_, index) => top + gap * index);
    const lineX = art.x + 14;
    return {lineX, top, bottom: top + gap * (ROWS - 1), rowY, textX: lineX + 22, right: art.x + art.w, font: small ? 11 : 13, nodeR: small ? 4 : 5};
}

/** Particle budget, by fraction of the pool: node rings, guide line, flow dots, separators. */
export function buildAgentSets(geom: AgentGeom, capacity: number, rng: () => number, width: number, height: number): AgentSets {
    const nodeK = Math.max(5, Math.floor(capacity * 0.006));
    const lineCount = Math.floor(capacity * 0.07);
    const flowCount = Math.max(8, Math.floor(capacity * 0.04));
    const sepCount = Math.max(6, Math.floor(capacity * 0.03));
    const base = createSet(capacity);
    scatterSet(base, 0, rng, width, height, () => 0);
    const put = (offset: number, points: Float32Array): void => {
        for (let i = 0; i < points.length / 2; i += 1) {
            base.x[offset + i] = points[i * 2];
            base.y[offset + i] = points[i * 2 + 1];
        }
    };
    geom.rowY.forEach((y, index) => put(index * nodeK, circleOutline(geom.lineX, y, geom.nodeR, nodeK)));
    const lineStart = ROWS * nodeK;
    put(lineStart, lineSamples(geom.lineX, geom.top, geom.lineX, geom.bottom, lineCount));
    const flowStart = lineStart + lineCount;
    for (let i = 0; i < flowCount; i += 1) {
        base.x[flowStart + i] = geom.lineX;
        base.y[flowStart + i] = geom.top;
    }
    const sepStart = flowStart + flowCount;
    for (let sep = 0; sep < ROWS - 1; sep += 1) {
        const y = (geom.rowY[sep] + geom.rowY[sep + 1]) / 2;
        put(sepStart + sep * sepCount, lineSamples(geom.textX, y, geom.right, y, sepCount));
    }
    const live: TargetSet = {x: Float32Array.from(base.x), y: Float32Array.from(base.y), a: new Float32Array(capacity)};
    return {base, live, nodeK, lineStart, lineCount, flowStart, flowCount, sepStart, sepCount};
}

/** How far down the line the light has travelled, as 0..1 (row 0 is 0, the last row is 1). */
function filled(local: number): number {
    let sum = 0;
    for (let i = 0; i < ROWS; i += 1) sum += rowLight(local, i);
    return clamp01((sum - 1) / (ROWS - 1));
}

export function planAgent(local: number, sets: Sets, geom: AgentGeom, out: Plan): void {
    const {live, nodeK, lineStart, lineCount, flowStart, flowCount, sepStart, sepCount} = sets.agent;
    const fill = filled(local);
    for (let row = 0; row < ROWS; row += 1) {
        const level = NODE_DIM + (1 - NODE_DIM) * rowLight(local, row);
        live.a.fill(level, row * nodeK, (row + 1) * nodeK);
    }
    for (let j = 0; j < lineCount; j += 1) {
        const lit = clamp01((fill - j / Math.max(1, lineCount - 1)) * 18);
        live.a[lineStart + j] = 0.14 + 0.4 * lit;
    }
    const flowFade = 1 - smoothstep((local - 0.7) / 0.1);
    const span = geom.bottom - geom.top;
    for (let j = 0; j < flowCount; j += 1) {
        const u = (local * FLOW_LOOPS + j / flowCount) % 1;
        live.y[flowStart + j] = geom.top + u * fill * span;
        live.a[flowStart + j] = fill > 0.02 ? 0.95 * Math.sin(Math.PI * u) * flowFade : 0;
    }
    for (let sep = 0; sep < ROWS - 1; sep += 1) live.a.fill(0.05 + 0.2 * rowLight(local, sep + 1), sepStart + sep * sepCount, sepStart + (sep + 1) * sepCount);
    out.alphaScale = overall(local);
    out.behavior = local < 0.2 ? "gather" : "form";
    if (local < ENTER_END) {
        out.from = sets.gridLit;
        out.to = live;
        out.t = smoothstep(local / ENTER_END);
    } else {
        out.from = live;
        out.to = live;
        out.t = 0;
    }
}

const FONT = '"PingFang SC", "Noto Sans SC", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const COOL = "96,177,255";
const WARM = "255,248,235";

export function drawAgent(ctx: CanvasRenderingContext2D, s: SceneState): void {
    const {local, layout} = s;
    const g = layout.agent;
    const fade = overall(local);
    if (fade < 0.01) return;
    const low = s.quality === "low";
    ctx.save();
    ctx.lineWidth = 1;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `400 ${g.font}px ${FONT}`;
    AGENT_ROWS.forEach((row, index) => {
        const light = rowLight(local, index) * fade;
        const y = g.rowY[index];
        const pending = index === APPROVAL_ROW && local >= ROW_START[index] && local < APPROVE_AT;
        const approved = index === APPROVAL_ROW ? smoothstep((local - APPROVE_AT) / APPROVE_SPAN) : 0;
        // The halo pulse when a node lights; the approval row pulses again when it is approved.
        if (!low) {
            const pulse = (local - ROW_START[index]) / (ROW_SPAN * 1.6);
            if (pulse > 0 && pulse < 1) {
                ctx.strokeStyle = `rgba(${pending || (index === APPROVAL_ROW && approved < 1) ? COOL : WARM},${0.45 * (1 - pulse) * fade})`;
                ctx.beginPath();
                ctx.arc(g.lineX, y, g.nodeR + 3 + 18 * pulse, 0, Math.PI * 2);
                ctx.stroke();
            }
            const again = index === APPROVAL_ROW ? (local - APPROVE_AT) / (APPROVE_SPAN * 1.6) : -1;
            if (again > 0 && again < 1) {
                ctx.strokeStyle = `rgba(${WARM},${0.45 * (1 - again) * fade})`;
                ctx.beginPath();
                ctx.arc(g.lineX, y, g.nodeR + 3 + 18 * again, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        if (light < 0.01) return;
        const typed = Math.ceil(row.text.length * clamp01(light * 1.5));
        const emphasis = row.kind === "user" ? 0.5 : row.kind === "summary" ? 0.55 : row.kind === "saved" ? 0.95 : 0.8;
        ctx.fillStyle = `rgba(${WARM},${emphasis * light})`;
        ctx.fillText(row.text.slice(0, typed), g.textX, y);
        if (index === APPROVAL_ROW) {
            const tagX = g.textX + ctx.measureText(row.text).width + 12;
            const mark = g.nodeR + 4;
            // A different node marker: a diamond in the cool accent while the call waits for you.
            const pendingLevel = pending ? light : 1 - approved;
            if (pendingLevel > 0.01 && local >= ROW_START[index]) {
                ctx.strokeStyle = `rgba(${COOL},${0.9 * pendingLevel * fade})`;
                ctx.beginPath();
                ctx.moveTo(g.lineX, y - mark);
                ctx.lineTo(g.lineX + mark, y);
                ctx.lineTo(g.lineX, y + mark);
                ctx.lineTo(g.lineX - mark, y);
                ctx.closePath();
                ctx.stroke();
                ctx.fillStyle = `rgba(${COOL},${0.9 * pendingLevel * fade})`;
                ctx.fillText(AGENT_PENDING, tagX, y);
            }
            if (approved > 0.01) {
                ctx.fillStyle = `rgba(${WARM},${0.5 * approved * fade})`;
                ctx.fillText(AGENT_APPROVED, tagX, y);
            }
        }
    });
    const tag = clamp01((local - 0.12) / 0.1) * fade;
    if (tag > 0.01) {
        ctx.font = '500 11px "PingFang SC", "Noto Sans SC", sans-serif';
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillStyle = `rgba(255,255,255,${0.5 * tag})`;
        ctx.fillText(AGENT_SCHEMATIC, layout.art.x + layout.art.w, layout.art.y + layout.art.h + 14);
    }
    ctx.restore();
}
