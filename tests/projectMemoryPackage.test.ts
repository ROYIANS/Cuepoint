import Dexie from "dexie";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createProject } from "@/db/repo";
import {
  createProjectMemory,
  MemoryConflictError,
  deleteProjectMemory,
  setProjectMemoryStatus,
  updateProjectMemory,
} from "@/db/projectMemories";
import type {
  MemoryInput,
  ProjectMemory,
  ProjectMemoryVersion,
} from "@/domain/projectMemory";
import {
  exportProjectZip,
  importProjectZip,
  PackageError,
} from "@/lib/projectPackage";

const input = (body = "统一使用暖色调"): MemoryInput => ({
  category: "convention",
  title: "色彩",
  topicKey: "色彩",
  body,
  applicability: "室内场景",
  tags: ["视觉"],
});
async function unpack(blob: Blob) {
  const zip = await JSZip.loadAsync(blob);
  return {
    zip,
    memories: JSON.parse(
      await zip.file("memories.json")!.async("string"),
    ) as ProjectMemory[],
    versions: (
      JSON.parse(
        await zip.file("memoryVersions.json")!.async("string"),
      ) as ProjectMemoryVersion[]
    ).sort((a, b) => a.revision - b.revision),
  };
}
async function rewrite(
  blob: Blob,
  mutate: (data: Awaited<ReturnType<typeof unpack>>) => void,
) {
  const data = await unpack(blob);
  mutate(data);
  data.zip.file("memories.json", JSON.stringify(data.memories));
  data.zip.file("memoryVersions.json", JSON.stringify(data.versions));
  return data.zip.generateAsync({ type: "blob" });
}
async function counts() {
  return Promise.all([
    db.projects.count(),
    db.episodes.count(),
    db.projectMemories.count(),
    db.projectMemoryVersions.count(),
  ]);
}

describe("project memory packages", () => {
  it("round-trips complete immutable histories and replacements as new pending-review aggregates", async () => {
    const project = await createProject("源项目");
    const first = (await createProjectMemory(project.id, input())).memory;
    await updateProjectMemory(project.id, first.id, input("修订后的暖色调"), 1);
    const replacement = (
      await createProjectMemory(project.id, input("改为冷色调"), {
        replace: { id: first.id, expectedRevision: 2 },
      })
    ).memory;
    await setProjectMemoryStatus(project.id, replacement.id, "disabled", 1);
    const foreign = await createProject("不相关");
    await createProjectMemory(foreign.id, input("不应该导出"));
    const blob = await exportProjectZip(project.id);
    const { zip, memories, versions } = await unpack(blob);
    expect(memories).toHaveLength(2);
    expect(versions).toHaveLength(5);
    expect(
      Object.keys(zip.files).some((name) => /chat|task|wrapup/i.test(name)),
    ).toBe(false);
    const imported = await importProjectZip(blob);
    const rows = await db.projectMemories
      .where("projectId")
      .equals(imported.id)
      .toArray();
    const history = await db.projectMemoryVersions
      .where("projectId")
      .equals(imported.id)
      .toArray();
    expect(rows).toHaveLength(2);
    expect(history).toHaveLength(7);
    for (const row of rows) {
      const original = memories.find((m) => m.body === row.body)!;
      expect(row.id).not.toBe(original.id);
      expect(row.status).toBe("pending_review");
      expect(row.reviewedAt).toBeUndefined();
      expect(row.revision).toBe(original.revision + 1);
      const chain = history
        .filter((v) => v.memoryId === row.id)
        .sort((a, b) => a.revision - b.revision);
      expect(chain.map((v) => v.revision)).toEqual(
        Array.from({ length: row.revision }, (_, i) => i + 1),
      );
      expect(chain.at(-1)?.snapshot).toEqual(row);
      expect(chain.at(-2)?.snapshot.status).toBe(original.status);
      expect(
        chain.every(
          (v) => !versions.some((old) => old.versionId === v.versionId),
        ),
      ).toBe(true);
      expect(
        chain.every(
          (v) =>
            v.projectId === imported.id && v.snapshot.projectId === imported.id,
        ),
      ).toBe(true);
      expect(row.source.kind).toBe("imported");
    }
    expect(
      rows.find((row) => row.body === "修订后的暖色调")?.supersededBy,
    ).toBe(rows.find((row) => row.body === "改为冷色调")?.id);
    const again = await importProjectZip(await exportProjectZip(imported.id));
    expect(
      await db.projectMemories.where("projectId").equals(again.id).count(),
    ).toBe(2);
    expect(
      await db.projectMemoryVersions
        .where("projectId")
        .equals(again.id)
        .count(),
    ).toBe(9);
    expect(await db.projectMemories.get(first.id)).toEqual(
      memories.find((row) => row.id === first.id),
    );
  });

  it.each([
    ["ＶＩＳＵＡＬ", "visual"],
    ["  ＶＩＳＵＡＬ   ＳＴＹＬＥ  ", "visual style"],
  ])(
    "normalizes imported topic %s across current and history before activation",
    async (rawTopic, normalizedTopic) => {
      const project = await createProject("主题归一化");
      const original = (await createProjectMemory(project.id, input())).memory;
      await updateProjectMemory(project.id, original.id, input("修订经验"), 1);
      const source = await rewrite(
        await exportProjectZip(project.id),
        (data) => {
          for (const row of data.memories) row.topicKey = rawTopic;
          for (const version of data.versions)
            version.snapshot.topicKey = rawTopic;
        },
      );
      const imported = await importProjectZip(source);
      const row = (await db.projectMemories
        .where("projectId")
        .equals(imported.id)
        .first())!;
      expect(row.topicKey).toBe(normalizedTopic);
      const history = await db.projectMemoryVersions
        .where("memoryId")
        .equals(row.id)
        .toArray();
      expect(history).toHaveLength(3);
      expect(
        history.every(
          (version) => version.snapshot.topicKey === normalizedTopic,
        ),
      ).toBe(true);
      await setProjectMemoryStatus(imported.id, row.id, "active", row.revision);
      await expect(
        createProjectMemory(imported.id, {
          ...input("与已导入经验不同的内容"),
          topicKey: normalizedTopic,
        }),
      ).rejects.toBeInstanceOf(MemoryConflictError);
      expect(
        await db.projectMemories.where("projectId").equals(imported.id).count(),
      ).toBe(1);
      expect((await db.projectMemories.get(original.id))?.topicKey).toBe(
        original.topicKey,
      );
    },
  );

  it("detaches live summary ownership but retains bounded source and evidence excerpts in every version", async () => {
    const project = await createProject("来源");
    const created = (await createProjectMemory(project.id, input())).memory;
    const source = {
      kind: "summary" as const,
      projectId: project.id,
      taskId: "old-task",
      threadId: "old-thread",
      summaryId: "old-summary",
      summaryRevision: 3,
      itemKind: "lesson" as const,
      itemIndex: 0,
      itemText: "保留实践经验",
      taskTitle: "已确认任务",
      confirmedAt: created.createdAt,
      excerpt: "保留实践经验",
      evidence: [
        {
          id: "tool:old-tool",
          label: "工具证据",
          body: "完整摘录",
          truncated: false,
        },
      ],
    };
    const row = { ...created, source };
    await db.projectMemories.put(row);
    const version = (await db.projectMemoryVersions
      .where("memoryId")
      .equals(row.id)
      .first())!;
    await db.projectMemoryVersions.put({ ...version, snapshot: row });
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const memory = (await db.projectMemories
      .where("projectId")
      .equals(imported.id)
      .first())!;
    expect(memory.source).toMatchObject({
      kind: "imported",
      originProjectId: project.id,
      originMemoryId: row.id,
      originalKind: "summary",
      excerpt: source.excerpt,
      evidence: source.evidence,
      summaryId: source.summaryId,
      summaryRevision: 3,
    });
    expect(memory.source).not.toHaveProperty("taskId");
    expect(memory.source).not.toHaveProperty("threadId");
    expect(memory.source).not.toHaveProperty("projectId");
    for (const v of await db.projectMemoryVersions
      .where("memoryId")
      .equals(memory.id)
      .toArray())
      expect(v.snapshot.source).toEqual(memory.source);
    expect(await db.chatThreads.count()).toBe(0);
    expect(await db.agentTasks.count()).toBe(0);
  });

  it("retains deleted replacement history without creating a foreign live link", async () => {
    const project = await createProject("删除替代条目");
    const old = (await createProjectMemory(project.id, input())).memory;
    const next = (
      await createProjectMemory(project.id, input("新经验"), {
        replace: { id: old.id, expectedRevision: 1 },
      })
    ).memory;
    await deleteProjectMemory(project.id, next.id, 1);
    const imported = await importProjectZip(await exportProjectZip(project.id));
    const row = (await db.projectMemories
      .where("projectId")
      .equals(imported.id)
      .first())!;
    expect(row.supersededBy).toBeUndefined();
    expect(row.status).toBe("pending_review");
    const history = await db.projectMemoryVersions
      .where("memoryId")
      .equals(row.id)
      .toArray();
    expect(history.find((v) => v.revision === 2)?.snapshot.status).toBe(
      "superseded",
    );
    expect(history.find((v) => v.revision === 2)?.reason).toBe("被明确替换");
    expect(history.find((v) => v.revision === row.revision)?.reason).toContain(
      "原替代条目已删除",
    );
    await expect(
      importProjectZip(await exportProjectZip(imported.id)),
    ).resolves.toBeDefined();
  });

  it("rejects malformed schemas, foreign ownership, inconsistent snapshots and incomplete version chains before writes", async () => {
    const project = await createProject("校验");
    const row = (await createProjectMemory(project.id, input())).memory;
    await updateProjectMemory(project.id, row.id, input("第二版"), 1);
    const blob = await exportProjectZip(project.id);
    const before = await counts();
    const mutations: Array<(data: Awaited<ReturnType<typeof unpack>>) => void> =
      [
        (d) => {
          d.memories.push(d.memories[0]);
        },
        (d) => {
          d.versions.push(d.versions[0]);
        },
        (d) => {
          d.versions.shift();
        },
        (d) => {
          d.versions[0].revision = 2;
        },
        (d) => {
          d.memories[0].projectId = "foreign";
        },
        (d) => {
          d.versions[0].snapshot.projectId = "foreign";
        },
        (d) => {
          d.versions[0].memoryId = "foreign";
        },
        (d) => {
          d.versions[1].snapshot.body = "篡改最后快照";
        },
        (d) => {
          Object.assign(d.memories[0], { credential: "not-allowed" });
        },
        (d) => {
          d.memories[0].body = "x".repeat(8001);
        },
        (d) => {
          d.memories[0].supersededBy = d.memories[0].id;
          d.versions[1].snapshot.supersededBy = d.memories[0].id;
        },
        (d) => {
          d.memories[0].source = {
            kind: "summary",
            projectId: "foreign",
            taskId: "t",
            threadId: "th",
            summaryId: "s",
            summaryRevision: 1,
            itemKind: "lesson",
            itemIndex: 0,
            itemText: "x",
            taskTitle: "x",
            confirmedAt: row.createdAt,
            excerpt: "x",
            evidence: [],
          };
          d.versions[1].snapshot.source = d.memories[0].source;
        },
      ];
    for (const mutate of mutations) {
      await expect(
        importProjectZip(await rewrite(blob, mutate)),
      ).rejects.toBeInstanceOf(PackageError);
      expect(await counts()).toEqual(before);
    }
    const { zip } = await unpack(blob);
    zip.file("memoryVersions.json", "null");
    await expect(
      importProjectZip(await zip.generateAsync({ type: "blob" })),
    ).rejects.toBeInstanceOf(PackageError);
    expect(await counts()).toEqual(before);
  });

  it("rejects a replacement cycle even when every snapshot and ID is otherwise valid", async () => {
    const project = await createProject("替代环");
    const first = (await createProjectMemory(project.id, input())).memory;
    await createProjectMemory(project.id, input("新的表达"), {
      replace: { id: first.id, expectedRevision: 1 },
    });
    const blob = await exportProjectZip(project.id);
    const before = await counts();
    const invalid = await rewrite(blob, (data) => {
      const firstRow = data.memories.find((row) => row.id === first.id)!;
      const second = data.memories.find((row) => row.id !== first.id)!;
      second.status = "superseded";
      second.supersededBy = firstRow.id;
      data.versions.find(
        (v) => v.memoryId === second.id && v.revision === second.revision,
      )!.snapshot = { ...second };
    });
    await expect(importProjectZip(invalid)).rejects.toBeInstanceOf(
      PackageError,
    );
    expect(await counts()).toEqual(before);
  });

  it("rolls back business rows and memories together on a version storage failure", async () => {
    const project = await createProject("事务");
    await createProjectMemory(project.id, input());
    const blob = await exportProjectZip(project.id);
    const before = await counts();
    const fail = () => {
      throw new Error("version storage failed");
    };
    db.projectMemoryVersions.hook("creating", fail);
    try {
      await expect(importProjectZip(blob)).rejects.toThrow(
        "version storage failed",
      );
    } finally {
      db.projectMemoryVersions.hook("creating").unsubscribe(fail);
    }
    expect(await counts()).toEqual(before);
  });

  it("captures current memory and versions with business records before concurrent edits", async () => {
    const project = await createProject("before");
    const row = (await createProjectMemory(project.id, input("before"))).memory;
    let edit: Promise<unknown> | undefined;
    const read = (value: typeof project) => {
      if (value?.id === project.id && !edit)
        edit = Dexie.ignoreTransaction(() =>
          db.transaction("rw", db.tables, async () => {
            await db.projects.update(project.id, { name: "after" });
            await updateProjectMemory(project.id, row.id, input("after"), 1);
          }),
        );
      return value;
    };
    db.projects.hook("reading", read);
    let blob: Blob;
    try {
      blob = await exportProjectZip(project.id);
    } finally {
      db.projects.hook("reading").unsubscribe(read);
    }
    await edit;
    const data = await unpack(blob);
    expect(
      JSON.parse(await data.zip.file("project.json")!.async("string")).name,
    ).toBe("before");
    expect(data.memories[0].body).toBe("before");
    expect(data.versions).toHaveLength(1);
    expect(data.versions[0].snapshot).toEqual(data.memories[0]);
    expect((await db.projectMemories.get(row.id))?.body).toBe("after");
  });

  it("accepts packages without memory arrays as an empty collection", async () => {
    const project = await createProject("无记忆");
    const { zip } = await unpack(await exportProjectZip(project.id));
    zip.remove("memories.json");
    zip.remove("memoryVersions.json");
    const imported = await importProjectZip(
      await zip.generateAsync({ type: "blob" }),
    );
    expect(
      await db.projectMemories.where("projectId").equals(imported.id).count(),
    ).toBe(0);
  });
});
