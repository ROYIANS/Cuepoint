// Target point sets. A set is particle-indexed: entry i is where particle i wants
// to be and how visible it should be. Sets are built only when the stage size or
// the display font changes, then cached by the controller.
export type Rect = {x: number; y: number; w: number; h: number};

export type TargetSet = {readonly x: Float32Array; readonly y: Float32Array; readonly a: Float32Array};

export function createSet(capacity: number): TargetSet {
    return {x: new Float32Array(capacity), y: new Float32Array(capacity), a: new Float32Array(capacity)};
}

/**
 * Where the scenes paint their picture: the big central frame, the star of the stage. On wide screens it takes
 * about two thirds of the width and 62% of the height, leaving the subtitle and the player bar below; on narrow
 * ones it is the whole width under the slate, with the subtitle beneath it.
 */
export function artRect(width: number, height: number): Rect {
    if (width >= 900) {
        const w = Math.max(200, Math.min(width * 0.66, height * 1.45));
        return {x: (width - w) / 2, y: height * 0.15, w, h: height * 0.6};
    }
    return {x: 20, y: height * 0.17, w: Math.max(120, width - 40), h: height * 0.5};
}

/** Scale of the pictures' fixed sizes (type, node radii, caps) with the frame: 1 on a phone, up to 1.45 on a wide stage. */
export function artScale(art: Rect): number {
    return art.w < 420 ? 1 : Math.min(1.45, Math.max(1, art.w / 600));
}

export type Bitmap = {readonly data: ArrayLike<number>; readonly width: number; readonly height: number};

export type SampleOptions = {
    maxPoints: number;
    /** Starting grid spacing in px; widened automatically until the count fits. */
    step?: number;
    /** Alpha channel value (0..255) above which a pixel counts as ink. */
    threshold?: number;
    rng: () => number;
    /** Added to every returned coordinate. */
    ox?: number;
    oy?: number;
    /** Sub-rectangle of the bitmap to sample. */
    region?: Rect;
};

function collect(bitmap: Bitmap, region: Rect, step: number, threshold: number, out: number[] | undefined): number {
    let count = 0;
    const x1 = Math.min(bitmap.width, Math.ceil(region.x + region.w));
    const y1 = Math.min(bitmap.height, Math.ceil(region.y + region.h));
    for (let y = Math.max(0, Math.floor(region.y)); y < y1; y += step) {
        for (let x = Math.max(0, Math.floor(region.x)); x < x1; x += step) {
            if (bitmap.data[(y * bitmap.width + x) * 4 + 3] > threshold) {
                if (out) out.push(x, y);
                count += 1;
            }
        }
    }
    return count;
}

/**
 * Down-samples an RGBA bitmap's inked pixels (alpha channel) to at most maxPoints
 * points, returned as a flat [x0, y0, x1, y1, ...] list in scan order. The grid
 * spacing grows until the count fits; any remainder is thinned evenly, so the
 * result is deterministic apart from the small jitter drawn from rng.
 */
export function samplePoints(bitmap: Bitmap, options: SampleOptions): Float32Array {
    const {rng, ox = 0, oy = 0, threshold = 100} = options;
    const maxPoints = Math.max(0, Math.floor(options.maxPoints));
    const region = options.region ?? {x: 0, y: 0, w: bitmap.width, h: bitmap.height};
    let step = Math.max(1, Math.round(options.step ?? 2));
    if (maxPoints === 0) return new Float32Array(0);
    let count = collect(bitmap, region, step, threshold, undefined);
    for (let guard = 0; count > maxPoints && guard < 8; guard += 1) {
        step = Math.max(step + 1, Math.ceil(step * Math.sqrt(count / maxPoints)));
        count = collect(bitmap, region, step, threshold, undefined);
    }
    const raw: number[] = [];
    collect(bitmap, region, step, threshold, raw);
    const total = raw.length / 2;
    const keep = Math.min(total, maxPoints);
    const out = new Float32Array(keep * 2);
    const jitter = step * 0.35;
    for (let j = 0; j < keep; j += 1) {
        const index = keep === total ? j : Math.floor((j * total) / keep);
        out[j * 2] = raw[index * 2] + ox + (rng() - 0.5) * jitter;
        out[j * 2 + 1] = raw[index * 2 + 1] + oy + (rng() - 0.5) * jitter;
    }
    return out;
}

/** Sorts a flat point list left to right (then top to bottom), so a revealed prefix reads like typing. */
export function sortPointsByX(points: Float32Array): Float32Array {
    const count = points.length / 2;
    const order = Array.from({length: count}, (_, index) => index).sort((a, b) => points[a * 2] - points[b * 2] || points[a * 2 + 1] - points[b * 2 + 1]);
    const out = new Float32Array(points.length);
    order.forEach((from, to) => {
        out[to * 2] = points[from * 2];
        out[to * 2 + 1] = points[from * 2 + 1];
    });
    return out;
}

function shuffleOrder(count: number, rng: () => number): number[] {
    const order = Array.from({length: count}, (_, index) => index);
    for (let i = count - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

/** Faint dust: particles without a point in a shape drift at random positions across the stage. */
export function scatterSet(set: TargetSet, from: number, rng: () => number, width: number, height: number, alpha: (index: number) => number): void {
    for (let i = from; i < set.x.length; i += 1) {
        set.x[i] = rng() * width;
        set.y[i] = rng() * height;
        set.a[i] = alpha(i);
    }
}

const DUST_ALPHA = (): number => 0.16;

/**
 * Particle i takes point i (optionally in shuffled order); the remainder become
 * dust. Returns how many particles carry a point.
 */
export function fillSet(set: TargetSet, points: Float32Array, options: {rng: () => number; shuffle: boolean; width: number; height: number}): number {
    const n = Math.min(set.x.length, points.length / 2);
    const order = options.shuffle ? shuffleOrder(n, options.rng) : undefined;
    for (let i = 0; i < n; i += 1) {
        const p = order ? order[i] : i;
        set.x[i] = points[p * 2];
        set.y[i] = points[p * 2 + 1];
        set.a[i] = 1;
    }
    scatterSet(set, n, options.rng, options.width, options.height, DUST_ALPHA);
    return n;
}

/** Evenly spaced points along a rectangle's border, starting at its top-left corner. */
export function rectOutline(rect: Rect, count: number): Float32Array {
    const out = new Float32Array(count * 2);
    const perimeter = 2 * (rect.w + rect.h);
    for (let i = 0; i < count; i += 1) {
        let d = (i / count) * perimeter;
        let x: number;
        let y: number;
        if (d < rect.w) { x = rect.x + d; y = rect.y; }
        else if ((d -= rect.w) < rect.h) { x = rect.x + rect.w; y = rect.y + d; }
        else if ((d -= rect.h) < rect.w) { x = rect.x + rect.w - d; y = rect.y + rect.h; }
        else { d -= rect.w; x = rect.x; y = rect.y + rect.h - d; }
        out[i * 2] = x;
        out[i * 2 + 1] = y;
    }
    return out;
}

/** Edges of a rectangle as flat [x1, y1, x2, y2, ...] segments. */
export function rectSegments(rect: Rect): number[] {
    const {x, y, w, h} = rect;
    return [x, y, x + w, y, x + w, y, x + w, y + h, x + w, y + h, x, y + h, x, y + h, x, y];
}

/**
 * `count` points spread evenly (by length) over flat [x1, y1, x2, y2, ...] segments.
 * Deterministic; a gap between segments costs nothing, so dashes are just short segments.
 */
export function segmentSamples(segments: readonly number[], count: number): Float32Array {
    const n = Math.max(0, Math.floor(count));
    const out = new Float32Array(n * 2);
    const segmentCount = Math.floor(segments.length / 4);
    if (n === 0 || segmentCount === 0) return out;
    let total = 0;
    for (let s = 0; s < segmentCount; s += 1) total += Math.hypot(segments[s * 4 + 2] - segments[s * 4], segments[s * 4 + 3] - segments[s * 4 + 1]);
    let segment = 0;
    let before = 0;
    let length = Math.hypot(segments[2] - segments[0], segments[3] - segments[1]);
    for (let i = 0; i < n; i += 1) {
        const d = ((i + 0.5) / n) * total;
        while (segment < segmentCount - 1 && d > before + length) {
            before += length;
            segment += 1;
            length = Math.hypot(segments[segment * 4 + 2] - segments[segment * 4], segments[segment * 4 + 3] - segments[segment * 4 + 1]);
        }
        const u = length > 0 ? Math.min(1, Math.max(0, (d - before) / length)) : 0;
        const o = segment * 4;
        out[i * 2] = segments[o] + (segments[o + 2] - segments[o]) * u;
        out[i * 2 + 1] = segments[o + 1] + (segments[o + 3] - segments[o + 1]) * u;
    }
    return out;
}

export function lineSamples(x1: number, y1: number, x2: number, y2: number, count: number): Float32Array {
    return segmentSamples([x1, y1, x2, y2], count);
}

/** Evenly spaced points on a circle (or an arc: `start` and `sweep` in radians; angle 0 points right, y grows down). */
export function circleOutline(cx: number, cy: number, r: number, count: number, start = 0, sweep = Math.PI * 2): Float32Array {
    const n = Math.max(0, Math.floor(count));
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i += 1) {
        const angle = start + (sweep * (i + 0.5)) / n;
        out[i * 2] = cx + Math.cos(angle) * r;
        out[i * 2 + 1] = cy + Math.sin(angle) * r;
    }
    return out;
}

export type CanvasLike = {width: number; height: number; getContext: (kind: "2d", options?: CanvasRenderingContext2DSettings) => CanvasRenderingContext2D | null};

export type TextPointsOptions = {
    font: (sizePx: number) => string;
    size: number;
    lineHeight: number;
    /** Anchor: the left edge for "left", the centre for "center". */
    x: number;
    /** Vertical centre of the whole text block. */
    y: number;
    align: "left" | "center";
    /** Shrinks the font so the widest line fits. */
    maxWidth?: number;
    maxPoints: number;
    rng: () => number;
    createCanvas: () => CanvasLike;
};

/**
 * Renders lines of text to an off-screen canvas and samples the ink into points
 * (stage coordinates). Lines are sampled separately and each is sorted left to
 * right, so the list reads line by line. Returns the points and the size used.
 */
export function textPoints(lines: readonly string[], options: TextPointsOptions): {points: Float32Array; size: number} {
    const canvas = options.createCanvas();
    const probe = canvas.getContext("2d", {willReadFrequently: true});
    if (!probe || lines.length === 0) return {points: new Float32Array(0), size: options.size};
    let size = options.size;
    probe.font = options.font(size);
    const widest = Math.max(...lines.map(line => probe.measureText(line).width));
    if (options.maxWidth && widest > options.maxWidth) size = Math.max(8, size * (options.maxWidth / widest));
    const lineHeight = options.lineHeight * (size / options.size);
    const pad = Math.ceil(size * 0.4);
    probe.font = options.font(size);
    const width = Math.ceil(Math.max(...lines.map(line => probe.measureText(line).width))) + pad * 2;
    const height = Math.ceil(lineHeight * lines.length) + pad * 2;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    if (!ctx) return {points: new Float32Array(0), size};
    ctx.clearRect(0, 0, width, height);
    ctx.font = options.font(size);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = options.align === "center" ? "center" : "left";
    lines.forEach((line, index) => ctx.fillText(line, options.align === "center" ? width / 2 : pad, pad + lineHeight * (index + 0.5)));
    const image = ctx.getImageData(0, 0, width, height);
    const perLine = Math.floor(options.maxPoints / lines.length);
    const left = options.align === "center" ? options.x - width / 2 : options.x - pad;
    const top = options.y - height / 2;
    const chunks = lines.map((_, index) => sortPointsByX(samplePoints(image, {
        maxPoints: perLine, rng: options.rng, ox: left, oy: top,
        region: {x: 0, y: pad + lineHeight * index, w: width, h: lineHeight},
        step: Math.max(1, Math.round(size / 22)),
    })));
    const points = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        points.set(chunk, offset);
        offset += chunk.length;
    }
    return {points, size};
}
