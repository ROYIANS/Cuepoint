import {describe, expect, it} from "vitest";
import {createProject} from "@/features/projects/commands/projects";
import {getProjectKind} from "@/features/projects/models/project";

describe("project kind compatibility", () => {
  it("defaults legacy missing-kind projects to video and rejects unknown kinds", async () => {
    const video = await createProject("video");
    expect(getProjectKind(video)).toBe("video");
    expect(() => getProjectKind({ kind: "alien" as "video" })).toThrow();
  });
});
