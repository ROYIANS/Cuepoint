import { db } from "./database";
import { PRODUCTION_TABLES, patchShot, setCharacterSlot, setPropSlot, setSceneSlot, setShotSlot, setStyleSlot } from "./repo";
import type { ProductionChange, ProductionProposal, ProductionTarget, ProposalSource } from "@/domain/production";
import type { GenerationResult, GenerationSlot } from "@/domain/types";
import { emptySlot } from "@/domain/slot";
import { createId, nowIso } from "@/lib/ids";
import { targetRevision, validateProductionTarget } from "@/lib/productionRevision";
import { flushPendingDrafts } from "@/lib/debouncedDraft";

async function readTarget(target: ProductionTarget) {
  if (!(await db.projects.get(target.projectId))) throw new Error("项目不存在");
  const entity = target.kind === "shot" ? await db.shots.get(target.entityId)
    : target.kind === "character" ? await db.characters.get(target.entityId)
    : target.kind === "scene" ? await db.scenes.get(target.entityId)
    : target.kind === "prop" ? await db.props.get(target.entityId) : await db.styles.get(target.entityId);
  if (!entity || entity.projectId !== target.projectId) throw new Error("变更目标不存在或不属于当前项目");
  if (target.kind === "shot") {
    const episode = await db.episodes.get(target.episodeId);
    if (!episode || episode.projectId !== target.projectId || !("episodeId" in entity) || entity.episodeId !== target.episodeId) {
      throw new Error("镜头不属于当前故事");
    }
  }
  let slot: GenerationSlot | undefined;
  if (target.slot) {
    if ("slots" in entity) {
      const slots: Partial<Record<string, GenerationSlot>> = entity.slots;
      slot = slots[target.slot] ?? emptySlot();
    } else if (target.slot === "firstFrame" || target.slot === "lastFrame" || target.slot === "clip") {
      slot = entity[target.slot];
    }
  }
  return { entity, slot, revision: targetRevision(entity) };
}

function normalizeChange(target: ProductionTarget, change: ProductionChange): ProductionChange {
  if (change.kind === "shot-text") {
    if (target.kind !== "shot" || target.slot) throw new Error("文字提案必须指向镜头文字");
    const patch: Extract<ProductionChange, {kind: "shot-text"}>["patch"] = {};
    for (const key of ["content", "notes"] as const) {
      if (Object.hasOwn(change.patch, key)) {
        if (typeof change.patch[key] !== "string") throw new Error("内容与备注必须是文字");
        patch[key] = change.patch[key];
      }
    }
    if (Object.hasOwn(change.patch, "durationSec")) {
      const duration = change.patch.durationSec;
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) throw new Error("时长必须是非负数");
      patch.durationSec = duration;
    }
    if (!Object.keys(patch).length) throw new Error("提案没有可修改的内容");
    return { kind: "shot-text", patch };
  }
  if (change.kind !== "slot-result" || !target.slot || !change.result?.mediaId ||
      (change.result.kind !== "image" && change.result.kind !== "video")) throw new Error("素材提案缺少有效目标或结果");
  if (change.result.kind === "video" && !(target.kind === "shot" && target.slot === "clip")) throw new Error("此槽位只能接收图片");
  return { kind: "slot-result", result: { mediaId: change.result.mediaId, kind: change.result.kind } };
}

async function validateResult(projectId: string, result: GenerationResult | undefined) {
  if (!result) return;
  const media = await db.media.get(result.mediaId);
  if (!media || media.projectId !== projectId || media.blob.size === 0 || !media.mimeType.startsWith(`${result.kind}/`)) {
    throw new Error("素材不存在、类型不匹配或不属于当前项目，请重新选择");
  }
}

function normalizeSource(source: ProposalSource): ProposalSource {
  const nonempty = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
  if (source.kind === "manual") return { kind: "manual" };
  if (source.kind !== "generation" || !nonempty(source.intentId) || !nonempty(source.provider) || !nonempty(source.model) || !Array.isArray(source.sourceRevisions)) {
    throw new Error("生成来源信息不完整");
  }
  if (source.providerTaskId !== undefined && !nonempty(source.providerTaskId)) throw new Error("供应商任务标识无效");
  for (const item of source.sourceRevisions) {
    if (!item || !nonempty(item.kind) || !nonempty(item.id) || !nonempty(item.revision) || !/^sha256-v1:[a-f0-9]{64}$/.test(item.revision)) {
      throw new Error("生成来源版本无效");
    }
  }
  return { kind: "generation", intentId: source.intentId, provider: source.provider, model: source.model,
    providerTaskId: source.providerTaskId,
    sourceRevisions: source.sourceRevisions.map(({ kind, id, revision }) => ({ kind, id, revision })) };
}

export async function createProductionProposal(input: {
  target: ProductionTarget; change: ProductionChange; source: ProposalSource; expectedRevision?: string;
}): Promise<ProductionProposal> {
  const target = validateProductionTarget(input.target);
  const change = normalizeChange(target, input.change);
  const source = normalizeSource(input.source);
  if (source.kind === "generation" && (!input.expectedRevision || !source.sourceRevisions.some((item) =>
    item.kind === target.kind && item.id === target.entityId && item.revision === input.expectedRevision))) {
    throw new Error("生成提案必须提供匹配目标的原始版本");
  }
  await flushPendingDrafts(target.projectId);
  return db.transaction("rw", PRODUCTION_TABLES, async () => {
    const current = await readTarget(target);
    if (input.expectedRevision !== undefined && current.revision !== input.expectedRevision) throw new Error("目标已被修改，请重新查看后创建提案");
    const before: ProductionProposal["before"] = {};
    if (change.kind === "shot-text" && "content" in current.entity) {
      for (const key of ["content", "notes", "durationSec"] as const) {
        if (Object.hasOwn(change.patch, key)) Object.assign(before, { [key]: current.entity[key] });
      }
    } else if (change.kind === "slot-result") {
      await validateResult(target.projectId, change.result);
      before.result = current.slot?.result;
    }
    const at = nowIso();
    const proposal: ProductionProposal = { id: createId("prpchange"), projectId: target.projectId,
      episodeId: target.kind === "shot" ? target.episodeId : undefined, target, change, source, before,
      baseRevision: current.revision, status: "pending", createdAt: at, updatedAt: at };
    await db.productionProposals.add(proposal);
    return proposal;
  });
}

async function writeResult(target: ProductionTarget, slot: GenerationSlot) {
  switch (target.kind) {
    case "shot": if (!target.slot) throw new Error("缺少素材槽位"); return setShotSlot(target.entityId, target.slot, slot);
    case "character": return setCharacterSlot(target.entityId, target.slot, slot);
    case "scene": return setSceneSlot(target.entityId, target.slot, slot);
    case "prop": return setPropSlot(target.entityId, target.slot, slot);
    case "style": return setStyleSlot(target.entityId, target.slot, slot);
  }
}

async function mutateProposal(id: string, projectId: string, action: "apply" | "cancel" | "undo") {
  await flushPendingDrafts(projectId);
  return db.transaction("rw", PRODUCTION_TABLES, async () => {
    const proposal = await db.productionProposals.get(id);
    if (!proposal || proposal.projectId !== projectId) throw new Error("提案不存在或不属于当前项目");
    const completed = action === "apply" ? "applied" : action === "cancel" ? "cancelled" : "undone";
    if (proposal.status === completed) return proposal;
    if (proposal.status !== (action === "undo" ? "applied" : "pending")) throw new Error("提案状态已变化，无法执行此操作");
    if (action !== "cancel") {
      const target = validateProductionTarget(proposal.target);
      if (target.projectId !== projectId) throw new Error("提案目标与项目不匹配");
      const current = await readTarget(target);
      const expected = action === "undo" ? proposal.appliedRevision : proposal.baseRevision;
      if (current.revision !== expected) throw new Error(action === "undo"
        ? "目标已有新的修改，无法撤销；你的当前内容已保留"
        : "目标已被修改，提案未应用。请取消此提案，查看最新内容后重新创建");
      const change = normalizeChange(target, proposal.change);
      if (change.kind === "shot-text") {
        const patch = action === "undo" ? { ...proposal.before } : change.patch;
        delete (patch as ProductionProposal["before"]).result;
        await patchShot(target.entityId, patch);
      } else {
        const result = action === "undo" ? proposal.before.result : change.result;
        await validateResult(projectId, result);
        await writeResult(target, { ...(current.slot ?? emptySlot()), result });
      }
      if (action === "apply") proposal.appliedRevision = (await readTarget(target)).revision;
    }
    const updated: ProductionProposal = { ...proposal, status: completed, updatedAt: nowIso() };
    await db.productionProposals.put(updated);
    return updated;
  });
}

export const applyProductionProposal = (id: string, projectId: string) => mutateProposal(id, projectId, "apply");
export const cancelProductionProposal = (id: string, projectId: string) => mutateProposal(id, projectId, "cancel");
export const undoProductionProposal = (id: string, projectId: string) => mutateProposal(id, projectId, "undo");
