import type { ProjectReference, ReferenceChunk } from "@/domain/references";
import type { ProjectMemory, ProjectMemoryVersion } from "@/domain/projectMemory";
import type { AgentTaskWrapup, AgentTaskWrapupVersion } from "@/domain/agentTaskWrapup";
import type { AgentTaskRecord, AgentTaskRecordVersion } from "@/domain/agentTaskRecords";
import type { AgentGenerationJob } from "@/domain/agentGeneration";
import type { ContextCompaction } from "@/domain/context";
import type { AgentConfig, AgentRun, AgentToolCall, AgentTask } from "@/domain/agent";
import type { ProductionProposal } from "@/domain/production";
import Dexie, { type Table } from "dexie";
import type {
  Character,
  ChatMessage,
  ChatThread,
  ConnectorConfig,
  Episode,
  MediaRecord,
  Project,
  Prop,
  Scene,
  Shot,
  VisualStyle,
} from "@/domain/types";
import { DEFAULT_VISIBLE_COLUMNS, getEpisodeShotFilters, normalizeEpisodeStory, normalizeSeriesStory } from "@/domain/types";
import { parseShotPictureSlots } from "@/domain/slot";
import { createId, nowIso } from "@/lib/ids";

export class AifenjingDB extends Dexie {
  projectReferences!: Table<ProjectReference, string>;
  referenceChunks!: Table<ReferenceChunk, string>;
  projectMemories!: Table<ProjectMemory, string>;
  projectMemoryVersions!: Table<ProjectMemoryVersion, string>;
  agentTaskWrapups!: Table<AgentTaskWrapup, string>;
  agentTaskWrapupVersions!: Table<AgentTaskWrapupVersion, string>;
  agentGenerationJobs!: Table<AgentGenerationJob, string>;
  contextCompactions!: Table<ContextCompaction, string>;
  agentTasks!: Table<AgentTask, string>;
  agentToolCalls!: Table<AgentToolCall, string>;
  agents!: Table<AgentConfig, string>;
  agentRuns!: Table<AgentRun, string>;
  productionProposals!: Table<ProductionProposal, string>;
  projects!: Table<Project, string>;
  characters!: Table<Character, string>;
  scenes!: Table<Scene, string>;
  props!: Table<Prop, string>;
  styles!: Table<VisualStyle, string>;
  episodes!: Table<Episode, string>;
  shots!: Table<Shot, string>;
  media!: Table<MediaRecord, string>;
  /** Studio-global AI connectors — never included in project ZIP export. */
  connectors!: Table<ConnectorConfig, string>;
  /** Studio-global Agent chat threads — never included in project ZIP export. */
  agentTaskRecords!: Table<AgentTaskRecord, string>;
  agentTaskRecordVersions!: Table<AgentTaskRecordVersion, string>;
  chatThreads!: Table<ChatThread, string>;
  /** Studio-global Agent chat messages — never included in project ZIP export. */
  chatMessages!: Table<ChatMessage, string>;

  constructor() {
    super("aifenjing");
    this.version(1).stores({
      projects: "id, updatedAt",
      characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt",
      shots: "id, projectId, order",
      media: "id, projectId",
    });
    this.version(2).stores({
      projects: "id, updatedAt",
      characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt",
      props: "id, projectId, updatedAt",
      styles: "id, projectId, updatedAt",
      shots: "id, projectId, order",
      media: "id, projectId",
    });
    this.version(3)
      .stores({
        projects: "id, updatedAt",
        characters: "id, projectId, updatedAt",
        scenes: "id, projectId, updatedAt",
        props: "id, projectId, updatedAt",
        styles: "id, projectId, updatedAt",
        episodes: "id, projectId, order, updatedAt",
        shots: "id, projectId, episodeId, order",
        media: "id, projectId",
      })
      .upgrade(async (tx) => {
        const projects = await tx.table("projects").toArray();
        const episodesTable = tx.table("episodes");
        const shotsTable = tx.table("shots");
        const at = nowIso();

        for (const project of projects) {
          const existing = await episodesTable.where("projectId").equals(project.id).count();
          if (existing > 0) continue;

          const rawStory =
            project.story && typeof project.story === "object"
              ? (project.story as Record<string, unknown>)
              : {};
          const episodeStory = normalizeEpisodeStory(rawStory);
          const episodeId = createId("ep");
          await episodesTable.add({
            id: episodeId,
            projectId: project.id,
            order: 0,
            title: "",
            story: episodeStory,
            createdAt: String(project.createdAt ?? at),
            updatedAt: at,
          });
          await tx.table("projects").put({
            ...project,
            story: normalizeSeriesStory(rawStory),
            columnSettings: { visible: [...DEFAULT_VISIBLE_COLUMNS] },
          });

          const shots = await shotsTable.where("projectId").equals(project.id).toArray();
          for (const shot of shots) {
            const record = { ...(shot as Record<string, unknown>) };
            const slots = parseShotPictureSlots(record);
            delete record.frame;
            delete record.reference;
            delete record.frameMediaId;
            delete record.referenceMediaId;
            await shotsTable.put({
              ...record,
              episodeId: String(record.episodeId ?? episodeId),
              ...slots,
            });
          }
        }
      });
    this.version(4).stores({
      projects: "id, updatedAt",
      characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt",
      props: "id, projectId, updatedAt",
      styles: "id, projectId, updatedAt",
      episodes: "id, projectId, order, updatedAt",
      shots: "id, projectId, episodeId, order",
      media: "id, projectId",
      connectors: "id, definitionId, updatedAt",
    });
    this.version(5).stores({
      projects: "id, updatedAt",
      characters: "id, projectId, updatedAt",
      scenes: "id, projectId, updatedAt",
      props: "id, projectId, updatedAt",
      styles: "id, projectId, updatedAt",
      episodes: "id, projectId, order, updatedAt",
      shots: "id, projectId, episodeId, order",
      media: "id, projectId",
      connectors: "id, definitionId, updatedAt",
      chatThreads: "id, updatedAt",
      chatMessages: "id, threadId, createdAt",
    });
    // Additive preference migration; existing indexes do not change.
    this.version(6).stores({}).upgrade(async (tx) => {
      const projects = await tx.table<Project>("projects").toArray();
      const episodes = tx.table<Episode>("episodes");
      for (const project of projects) {
        const owned = await episodes.where("projectId").equals(project.id).toArray();
        for (const episode of owned) {
          await episodes.update(episode.id, { shotFilters: getEpisodeShotFilters(episode, project) });
        }
      }
    });
    this.version(7).stores({ productionProposals: "id, projectId, episodeId, status, createdAt" });
    this.version(8).stores({
      agents: "id",
      agentRuns: "id, threadId, status, createdAt",
    }).upgrade(async (tx) => {
      await tx.table<ChatMessage>("chatMessages").filter((message) =>
        message.status === "streaming" || message.status === "pending",
      ).modify((message) => {
        message.status = "interrupted";
        message.error = "上次生成已中断，已保留收到的内容。可重新发送问题。";
      });
    });
    this.version(9).stores({ agentToolCalls: "id, runId, threadId, &[runId+providerCallId], status" });
    this.version(10).stores({ agentTasks: "id, &threadId, lifecycle, updatedAt", agentRuns: "id, threadId, taskId, status, createdAt" });
    this.version(11).stores({ contextCompactions: "id, threadId, runId, status, createdAt" });
    this.version(12).stores({ agentGenerationJobs: "id, &callId, runId, threadId, projectId, status, fingerprint, updatedAt" });
    this.version(13).stores({ agentTaskRecords: "id, taskId, [taskId+kind], updatedAt", agentTaskRecordVersions: "versionId, taskId, recordId, &[recordId+revision]" });
    this.version(14).stores({ agentTaskWrapups: "id, taskId, threadId, status, createdAt", agentTaskWrapupVersions: "versionId, taskId, threadId, &[id+revision]" });
    this.version(15).stores({ chatThreads: "id, projectId, updatedAt", agentTasks: "id, &threadId, projectId, lifecycle, updatedAt", agentRuns: "id, threadId, taskId, projectId, status, createdAt" });
    this.version(16).stores({ projectMemories: "id, projectId, [projectId+status], updatedAt", projectMemoryVersions: "versionId, projectId, memoryId, &[memoryId+revision]" });
    this.version(17).stores({ projectReferences: "id, projectId, mediaId, [projectId+digest], updatedAt", referenceChunks: "id, projectId, referenceId, &[referenceId+revision+index]" });
  }
}

export const db = new AifenjingDB();
