// Fixed-capacity particle pool. Every array is allocated once; step() writes in
// place and allocates nothing, so a frame never produces garbage. Motion is a
// per-particle damped spring toward (tx, ty) with a target opacity `ta`.
export type Quality = "high" | "medium" | "low";

/** Particle capacity per quality tier. */
export const MAX_PARTICLES: Readonly<Record<Quality, number>> = {high: 1400, medium: 700, low: 260};

/** Deterministic PRNG (mulberry32): the same seed always gives the same sequence. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export type Pool = {
    readonly capacity: number;
    readonly x: Float32Array;
    readonly y: Float32Array;
    readonly vx: Float32Array;
    readonly vy: Float32Array;
    readonly tx: Float32Array;
    readonly ty: Float32Array;
    readonly alpha: Float32Array;
    /** Target opacity. */
    readonly ta: Float32Array;
    /** Sprite radius basis in px. */
    readonly size: Float32Array;
    /** Per-particle stiffness factor, so a group arrives staggered instead of as one block. */
    readonly stiff: Float32Array;
};

export function createPool(capacity: number, seed = 1): Pool {
    const n = Math.max(0, Math.floor(capacity));
    const pool: Pool = {
        capacity: n,
        x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
        tx: new Float32Array(n), ty: new Float32Array(n), alpha: new Float32Array(n), ta: new Float32Array(n),
        size: new Float32Array(n), stiff: new Float32Array(n),
    };
    const random = mulberry32(seed);
    for (let i = 0; i < n; i += 1) {
        pool.size[i] = 0.9 + random() * 1.7;
        pool.stiff[i] = 0.75 + random() * 0.6;
    }
    return pool;
}

export type Behavior = "scatter" | "gather" | "form";

// k: spring stiffness (1/s^2), zeta: damping ratio, fade: opacity easing rate (1/s).
export const BEHAVIORS: Readonly<Record<Behavior, { k: number; zeta: number; fade: number }>> = {
    scatter: {k: 8, zeta: 0.7, fade: 4},
    gather: {k: 40, zeta: 0.9, fade: 6},
    form: {k: 70, zeta: 1, fade: 8},
};

const MAX_STEP = 1 / 30;
const SNAP_DISTANCE = 0.3;
const SNAP_SPEED = 2;
const SNAP_ALPHA = 0.004;

/**
 * Advances the pool by dt seconds (clamped to 1/30 so a hitch cannot blow the
 * spring up) and returns how many particles have not yet settled. A settled
 * particle sits exactly on its target with zero velocity, so a return value of 0
 * means nothing will move until a target changes: the caller can stop its frames.
 */
export function step(pool: Pool, dt: number, behavior: Behavior): number {
    const params = BEHAVIORS[behavior];
    const h = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), MAX_STEP);
    const fade = 1 - Math.exp(-params.fade * h);
    const {x, y, vx, vy, tx, ty, alpha, ta, stiff} = pool;
    let unsettled = 0;
    for (let i = 0; i < pool.capacity; i += 1) {
        const k = params.k * stiff[i];
        const damping = 2 * params.zeta * Math.sqrt(k);
        vx[i] += ((tx[i] - x[i]) * k - damping * vx[i]) * h;
        vy[i] += ((ty[i] - y[i]) * k - damping * vy[i]) * h;
        x[i] += vx[i] * h;
        y[i] += vy[i] * h;
        alpha[i] += (ta[i] - alpha[i]) * fade;
        let moving = false;
        if (Math.abs(vx[i]) + Math.abs(vy[i]) < SNAP_SPEED && Math.abs(tx[i] - x[i]) + Math.abs(ty[i] - y[i]) < SNAP_DISTANCE) {
            x[i] = tx[i];
            y[i] = ty[i];
            vx[i] = 0;
            vy[i] = 0;
        } else {
            moving = true;
        }
        if (Math.abs(ta[i] - alpha[i]) < SNAP_ALPHA) alpha[i] = ta[i];
        else moving = true;
        if (moving) unsettled += 1;
    }
    return unsettled;
}
