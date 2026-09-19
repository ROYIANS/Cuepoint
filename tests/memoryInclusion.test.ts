import { describe, expect, it } from "vitest";
import { createProject } from "@/db/repo";
import {
  createProjectMemory,
  updateProjectMemory,
  listProjectMemoryVersions,
  listProjectMemories,
} from "@/db/projectMemories";
import { exportProjectZip, importProjectZip } from "@/lib/projectPackage";
import { memoryInputSchema } from "@/lib/memory/schema";
const input = {
  category: "convention" as const,
  title: "角色命名",
  topicKey: "角色命名",
  body: "使用角色表中的名称",
  applicability: "整个项目",
  tags: [],
};
describe("explicit memory inclusion", () => {
  it("never infers project-wide policy and preserves opt-in through revisions and backup review", async () => {
    const project = await createProject("P");
    const row = (await createProjectMemory(project.id, input)).memory;
    expect(row.inclusion).not.toBe("project");
    const changed = await updateProjectMemory(
      project.id,
      row.id,
      { ...input, inclusion: "project" },
      row.revision,
    );
    expect(changed.inclusion).toBe("project");
    const history = await listProjectMemoryVersions(project.id, row.id);
    expect(history[1].snapshot.inclusion).not.toBe("project");
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const restored = (await listProjectMemories(imported.id))[0];
    expect(restored.inclusion).toBe("project");
    expect(restored.status).toBe("pending_review");
    expect(
      (await listProjectMemoryVersions(imported.id, restored.id))[1].snapshot
        .inclusion,
    ).toBe("project");
    await updateProjectMemory(
      project.id,
      row.id,
      { ...input, inclusion: "relevant" },
      changed.revision,
    );
    expect((await listProjectMemories(project.id))[0].inclusion).toBe(
      "relevant",
    );
  });
  it("rejects invented inclusion policy", () => {
    expect(
      memoryInputSchema.safeParse({ ...input, inclusion: "force" }).success,
    ).toBe(false);
  });
});
