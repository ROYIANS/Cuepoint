import { describe, expect, it } from "vitest";
import {
  THINK_COLS,
  THINK_ROWS,
  paintSnakeCells,
  stepColumn,
} from "@/components/agent/ThinkingMatrix";

describe("ThinkingMatrix snakes", () => {
  it("lights two stacked cells in a column for a downward snake", () => {
    const cells = paintSnakeCells([
      { head: 1, dir: 1 },
      { head: -10, dir: 1 },
      { head: -10, dir: 1 },
    ]);
    expect(cells[0 * THINK_COLS + 0]).toBe(true);
    expect(cells[1 * THINK_COLS + 0]).toBe(true);
    expect(cells.filter(Boolean)).toHaveLength(2);
  });

  it("allows the snake to leave the bottom then reverse upward", () => {
    let col = { head: 3, dir: 1 as const };
    col = stepColumn(col);
    expect(col).toEqual({ head: 4, dir: 1 });
    expect(
      paintSnakeCells([col, { head: -10, dir: 1 }, { head: -10, dir: 1 }]).some(Boolean),
    ).toBe(false);

    col = stepColumn(col);
    expect(col.dir).toBe(-1);
    expect(col.head).toBe(3);
  });

  it("bounces at the top while both dots are still visible", () => {
    const atTop = paintSnakeCells([
      { head: 0, dir: -1 },
      { head: -10, dir: 1 },
      { head: -10, dir: 1 },
    ]);
    expect(atTop[0 * THINK_COLS + 0]).toBe(true);
    expect(atTop[1 * THINK_COLS + 0]).toBe(true);

    const col = stepColumn({ head: 0, dir: -1 });
    expect(col).toEqual({ head: 1, dir: 1 });
    const after = paintSnakeCells([
      col,
      { head: -10, dir: 1 },
      { head: -10, dir: 1 },
    ]);
    expect(after[0 * THINK_COLS + 0]).toBe(true);
    expect(after[1 * THINK_COLS + 0]).toBe(true);
  });

  it("keeps grid size 3×3", () => {
    expect(THINK_COLS * THINK_ROWS).toBe(9);
    expect(paintSnakeCells([]).length).toBe(9);
  });

  it("staggers columns by two head steps so 1/2/3 stay out of phase", () => {
    let cols = [
      { head: 0, dir: 1 as const },
      { head: -2, dir: 1 as const },
      { head: -4, dir: 1 as const },
    ];
    for (let i = 0; i < 2; i++) cols = cols.map(stepColumn);
    const cells = paintSnakeCells(cols);
    const litIn = (c: number) =>
      [0, 1, 2].filter((r) => cells[r * THINK_COLS + c]).join(",");
    expect(litIn(0)).not.toBe(litIn(1));
    expect(litIn(1)).not.toBe(litIn(2));
    expect(litIn(0)).not.toBe(litIn(2));
  });
});
