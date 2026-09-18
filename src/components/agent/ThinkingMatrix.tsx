import { useEffect, useState } from "react";

/** 3 columns × 3 rows — Cursor-style column snakes, not random noise. */
export const THINK_COLS = 3;
export const THINK_ROWS = 3;
const CELL_COUNT = THINK_COLS * THINK_ROWS;
const SNAKE_LEN = 2;
/** 50% slower than the prior 110ms tick. */
const TICK_MS = 220;
/** Two head-steps of lag between column 1 → 2 → 3. */
const COLUMN_PHASE = 2;

type ColState = { head: number; dir: 1 | -1 };

function emptyCells(): boolean[] {
  return Array.from({ length: CELL_COUNT }, () => false);
}

/** Paint a length-2 snake: head leads, body trails opposite `dir`. */
export function paintSnakeCells(columns: ColState[]): boolean[] {
  const cells = emptyCells();
  for (let c = 0; c < THINK_COLS; c++) {
    const col = columns[c];
    if (!col) continue;
    const { head, dir } = col;
    for (let i = 0; i < SNAKE_LEN; i++) {
      const row = head - i * dir;
      if (row >= 0 && row < THINK_ROWS) {
        cells[row * THINK_COLS + c] = true;
      }
    }
  }
  return cells;
}

/**
 * Advance one column: fully exit the bottom before climbing back;
 * at the top keep both dots visible, then turn around (no single-dot peek).
 */
export function stepColumn({ head, dir }: ColState): ColState {
  // Already fully below the grid → turn around and climb.
  if (dir === 1 && head - (SNAKE_LEN - 1) >= THINK_ROWS) {
    return { head: head - 1, dir: -1 };
  }
  // Both dots sit at the top (head at row 0 while climbing) → descend.
  // Do not step to head < 0, which would leave only one lit cell.
  if (dir === -1 && head <= 0) {
    return { head: SNAKE_LEN - 1, dir: 1 };
  }
  return { head: head + dir, dir };
}

function initialColumns(): ColState[] {
  // Column order 1→2→3: each starts further above the grid so they enter in sequence.
  return Array.from({ length: THINK_COLS }, (_, c) => ({
    head: 0 - c * COLUMN_PHASE,
    dir: 1 as const,
  }));
}

const STATIC_PATTERN = paintSnakeCells([
  { head: 1, dir: 1 },
  { head: -1, dir: 1 },
  { head: -3, dir: 1 },
]);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * 3×3 square-cell thinking indicator: per-column 2-dot snakes (1→2→3),
 * bounce at top, may vanish at bottom. Not a spinner / LoadingDots.
 */
export function ThinkingMatrix() {
  const [columns, setColumns] = useState<ColState[]>(initialColumns);
  const reduced = prefersReducedMotion();
  const cells = reduced ? STATIC_PATTERN : paintSnakeCells(columns);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setColumns((prev) => prev.map(stepColumn));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="agent-thinking-matrix"
      role="status"
      aria-label="思考中"
      aria-busy={true}
    >
      <div className="agent-thinking-matrix-grid" aria-hidden>
        {cells.map((on, i) => (
          <span
            key={i}
            className={
              on
                ? "agent-thinking-matrix-dot agent-thinking-matrix-dot--on"
                : "agent-thinking-matrix-dot"
            }
          />
        ))}
      </div>
    </div>
  );
}
