import { expect, it } from "vitest";
import { copySelection } from "@/lib/copySelection";

it("retries only uncommitted copies after partial failure, including stale selected IDs", async () => {
  const remaining = new Set(["existing", "a", "b", "c"]);
  const calls: string[] = [];
  let fail = true;
  const run = () => copySelection(remaining, new Set(["existing"]), async (id) => {
    calls.push(id);
    if (id === "b" && fail) throw new Error("quota");
  }, (id) => remaining.delete(id));
  await expect(run()).rejects.toThrow("quota");
  expect([...remaining]).toEqual(["b", "c"]);
  fail = false;
  await expect(run()).resolves.toBe(2);
  expect([...remaining]).toEqual([]);
  expect(calls).toEqual(["a", "b", "b", "c"]);
});
