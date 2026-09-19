import { describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { createProject, deleteProject, deleteChatThread } from "@/db/repo";
import { createAgentTask, setAgentTaskLifecycle } from "@/db/agentTasks";
import {
  createManualWrapup,
  saveWrapup,
  confirmWrapup,
} from "@/db/agentTaskWrapups";
import {
  createProjectMemory,
  deleteProjectMemory,
  getMemorySourceState,
  getProjectMemory,
  listMemoryCandidates,
  listProjectMemories,
  listProjectMemoryVersions,
  MemoryConflictError,
  promoteProjectMemory,
  replaceProjectMemory,
  setProjectMemoryStatus,
  updateProjectMemory,
} from "@/db/projectMemories";
import type { MemoryInput } from "@/domain/projectMemory";
const input: MemoryInput = {
  category: "convention",
  title: "画面约定",
  topicKey: "visual",
  body: "使用温暖色调",
  applicability: "本项目的回忆场景",
  tags: ["视觉"],
};
async function source() {
  const project = await createProject("测试"),
    task = await createAgentTask({
      projectId: project.id,
      title: "创作任务",
      goal: "交付",
      acceptanceCriteria: [],
    });
  const draft = await createManualWrapup(task.id);
  const saved = await saveWrapup(
    task.id,
    draft.id,
    {
      ...draft.content,
      overview: "人工核实",
      decisions: [{ text: "人物服装保持蓝色", sourceIds: [] }],
      lessons: [{ text: "先确认镜头节奏，再生成素材", sourceIds: [] }],
    },
    draft.revision,
  );
  const review = await confirmWrapup(task.id, saved.id, saved.revision);
  return { project, task, review };
}
describe("project memory repository", () => {
  it("creates, revises, disables, reactivates and deletes offline with immutable CAS history", async () => {
    const project = await createProject("P"),
      created = await createProjectMemory(project.id, input);
    expect(created.duplicate).toBe(false);
    expect(created.memory.status).toBe("active");
    expect(created.memory.source.kind).toBe("manual");
    const changed = await updateProjectMemory(
      project.id,
      created.memory.id,
      { ...input, body: "使用冷色调" },
      1,
    );
    await expect(
      updateProjectMemory(project.id, changed.id, input, 1),
    ).rejects.toThrow("已更新");
    const disabled = await setProjectMemoryStatus(
      project.id,
      changed.id,
      "disabled",
      2,
    );
    const active = await setProjectMemoryStatus(
      project.id,
      changed.id,
      "active",
      disabled.revision,
    );
    expect(
      (await listProjectMemoryVersions(project.id, changed.id)).map(
        (v) => v.snapshot.body,
      ),
    ).toEqual(["使用冷色调", "使用冷色调", "使用冷色调", "使用温暖色调"]);
    db.close();
    await db.open();
    expect((await getProjectMemory(project.id, changed.id))?.status).toBe(
      "active",
    );
    await expect(
      deleteProjectMemory(project.id, changed.id, 1),
    ).rejects.toThrow("已更新");
    await deleteProjectMemory(project.id, changed.id, active.revision);
    expect(await db.projectMemoryVersions.count()).toBe(0);
    expect(await listProjectMemories(project.id)).toEqual([]);
  });
  it("deduplicates normalized exact content and source submissions without reactivating a disabled entry", async () => {
    const project = await createProject("P");
    const first = await createProjectMemory(project.id, input);
    expect(
      (
        await createProjectMemory(project.id, {
          ...input,
          title: "别的标题",
          body: " 使用温暖色调 ",
        })
      ).memory.id,
    ).toBe(first.memory.id);
    await setProjectMemoryStatus(project.id, first.memory.id, "disabled", 1);
    expect((await createProjectMemory(project.id, input)).memory.status).toBe(
      "disabled",
    );
    expect(await db.projectMemories.count()).toBe(1);
  });
  it("rejects same topic conflicts and atomically replaces with stale-revision protection", async () => {
    const project = await createProject("P"),
      first = (await createProjectMemory(project.id, input)).memory;
    const replacement = { ...input, body: "明确改为蓝色" };
    await expect(
      createProjectMemory(project.id, replacement),
    ).rejects.toBeInstanceOf(MemoryConflictError);
    await updateProjectMemory(
      project.id,
      first.id,
      { ...input, title: "先改标题" },
      1,
    );
    await expect(
      createProjectMemory(project.id, replacement, {
        replace: { id: first.id, expectedRevision: 1 },
      }),
    ).rejects.toThrow("已更新");
    expect(await db.projectMemories.count()).toBe(1);
    const next = (
      await createProjectMemory(project.id, replacement, {
        replace: { id: first.id, expectedRevision: 2 },
      })
    ).memory;
    expect((await getProjectMemory(project.id, first.id))?.supersededBy).toBe(
      next.id,
    );
    expect(
      (await listProjectMemories(project.id)).filter(
        (m) => m.status === "active",
      ),
    ).toHaveLength(1);
    await expect(
      setProjectMemoryStatus(project.id, first.id, "active", 3),
    ).rejects.toThrow("替代");
    await deleteProjectMemory(project.id, next.id, 1);
    expect(
      (await listProjectMemoryVersions(project.id, first.id))[0].snapshot
        .supersededBy,
    ).toBe(next.id);
  });
  it("existing-row replacement compares both revisions and rolls back both records if version persistence fails", async () => {
    const project = await createProject("P"),
      old = (await createProjectMemory(project.id, input)).memory,
      newer = (
        await createProjectMemory(project.id, {
          ...input,
          topicKey: "other",
          body: "新的规则",
        })
      ).memory;
    await expect(
      replaceProjectMemory(project.id, old.id, newer.id, {
        oldRevision: 1,
        newRevision: 2,
      }),
    ).rejects.toThrow("已更新");
    const spy = vi
      .spyOn(db.projectMemoryVersions, "add")
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(
      replaceProjectMemory(project.id, old.id, newer.id, {
        oldRevision: 1,
        newRevision: 1,
      }),
    ).rejects.toThrow("disk full");
    spy.mockRestore();
    expect((await getProjectMemory(project.id, old.id))?.status).toBe("active");
    expect((await getProjectMemory(project.id, newer.id))?.revision).toBe(1);
    await replaceProjectMemory(project.id, old.id, newer.id, {
      oldRevision: 1,
      newRevision: 1,
    });
    expect((await getProjectMemory(project.id, old.id))?.status).toBe(
      "superseded",
    );
  });
  it("promotes exact confirmed decision and lesson revisions including completed archived and historical sources", async () => {
    const { project, task, review } = await source();
    await setAgentTaskLifecycle(task.id, "completed", {
      id: review.id,
      revision: review.revision,
    });
    await setAgentTaskLifecycle(task.id, "archived");
    const candidates = await listMemoryCandidates(
      project.id,
      task.id,
      review.id,
      review.revision,
    );
    expect(candidates.map((c) => c.input.category)).toEqual([
      "decision",
      "lesson",
    ]);
    const selected = candidates[1],
      saved = await promoteProjectMemory(project.id, selected.ref, {
        ...selected.input,
        body: "先确认节奏，再生图",
      });
    expect(saved.memory.source).toMatchObject({
      kind: "summary",
      summaryRevision: review.revision,
      taskId: task.id,
      itemText: "先确认镜头节奏，再生成素材",
    });
    expect(
      (
        await promoteProjectMemory(project.id, selected.ref, {
          ...selected.input,
          body: "再次点击不同措辞",
        })
      ).memory.id,
    ).toBe(saved.memory.id);
    await db.projects.update(project.id, { brief: "变化后的项目" });
    expect(
      (await getMemorySourceState(project.id, saved.memory.id)).state,
    ).toBe("historical");
    await deleteChatThread(task.threadId);
    expect(await getProjectMemory(project.id, saved.memory.id)).toBeDefined();
    expect(
      (await getMemorySourceState(project.id, saved.memory.id)).state,
    ).toBe("missing");
    expect(
      (await getProjectMemory(project.id, saved.memory.id))?.source,
    ).toMatchObject({ excerpt: selected.ref.itemText });
  });
  it("retains exact old confirmation provenance after a newer summary and bounds copied evidence", async () => {
    const { project, task, review } = await source();
    const old = (
      await listMemoryCandidates(
        project.id,
        task.id,
        review.id,
        review.revision,
      )
    )[0];
    const draft = await createManualWrapup(task.id);
    const saved = await saveWrapup(
      task.id,
      draft.id,
      {
        ...draft.content,
        overview: "新的确认",
        decisions: [{ text: "新服装决定", sourceIds: [] }],
      },
      draft.revision,
    );
    await confirmWrapup(task.id, saved.id, saved.revision);
    const candidates = await listMemoryCandidates(
      project.id,
      task.id,
      review.id,
      review.revision,
    );
    expect(candidates[0].state).toBe("historical");
    const memory = (await promoteProjectMemory(project.id, old.ref, old.input))
      .memory;
    expect(memory.source).toMatchObject({
      summaryId: review.id,
      summaryRevision: review.revision,
      itemText: old.ref.itemText,
    });
    expect((await getMemorySourceState(project.id, memory.id)).state).toBe(
      "historical",
    );
  });
  it("enforces project and source ownership at every public operation and rejects fabricated text/unconfirmed revisions", async () => {
    const { project, task, review } = await source(),
      foreign = await createProject("Other"),
      candidate = (
        await listMemoryCandidates(
          project.id,
          task.id,
          review.id,
          review.revision,
        )
      )[0];
    await expect(
      promoteProjectMemory(foreign.id, candidate.ref, candidate.input),
    ).rejects.toThrow("当前项目");
    await expect(
      promoteProjectMemory(
        project.id,
        { ...candidate.ref, itemText: "编造" },
        candidate.input,
      ),
    ).rejects.toThrow("已变化");
    await expect(
      promoteProjectMemory(
        project.id,
        { ...candidate.ref, summaryRevision: 1 },
        candidate.input,
      ),
    ).rejects.toThrow("已确认");
    const row = (await createProjectMemory(project.id, input)).memory;
    for (const operation of [
      () => getProjectMemory(foreign.id, row.id),
      () => updateProjectMemory(foreign.id, row.id, input, 1),
      () => listProjectMemoryVersions(foreign.id, row.id),
      () => deleteProjectMemory(foreign.id, row.id, 1),
      () => getMemorySourceState(foreign.id, row.id),
    ])
      await expect(operation()).rejects.toThrow("项目");
    await expect(createProjectMemory("studio", input)).rejects.toThrow("项目");
    await expect(
      createProjectMemory(project.id, {
        ...input,
        source: { kind: "manual" },
      } as MemoryInput),
    ).rejects.toThrow();
  });
  it("project deletion removes memories and all versions while a source deletion preserves them", async () => {
    const project = await createProject("P"),
      other = await createProject("O");
    await createProjectMemory(project.id, input);
    await createProjectMemory(other.id, input);
    await deleteProject(project.id);
    expect(
      await db.projectMemories.where("projectId").equals(project.id).count(),
    ).toBe(0);
    expect(
      await db.projectMemoryVersions
        .where("projectId")
        .equals(project.id)
        .count(),
    ).toBe(0);
    expect(await listProjectMemories(other.id)).toHaveLength(1);
  });
  it("serializes concurrent duplicate submissions and preserves pending-review imports until explicit activation", async () => {
    const project = await createProject("P");
    const results = await Promise.all([
      createProjectMemory(project.id, input),
      createProjectMemory(project.id, input),
    ]);
    expect(results[0].memory.id).toBe(results[1].memory.id);
    expect(results.filter((r) => r.duplicate)).toHaveLength(1);
    const row = results[0].memory;
    await db.projectMemories.update(row.id, {
      status: "pending_review",
      source: {
        kind: "imported",
        originProjectId: "old",
        originMemoryId: "oldm",
        originalKind: "manual",
        excerpt: "保留文字",
      },
    });
    expect((await getMemorySourceState(project.id, row.id)).state).toBe(
      "imported",
    );
    expect(
      (
        await updateProjectMemory(
          project.id,
          row.id,
          { ...input, body: "复核稿" },
          1,
        )
      ).status,
    ).toBe("pending_review");
    expect(
      (await setProjectMemoryStatus(project.id, row.id, "active", 2)).status,
    ).toBe("active");
  });
});
