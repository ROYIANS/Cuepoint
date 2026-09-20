import { z } from "zod";
import type { ConnectorConfig, MediaKind } from "@/domain/types";
import type { ProjectGenerationDefaults } from "@/domain/output";
import { validateGenerationDefaults } from "@/domain/output";
import type { GenerationPreference, GenerationPreferences, GenerationPreferenceState, GenerationSelection } from "@/domain/generationPreferences";
import { generationSubmitSchema, profileRequest } from "./generationProfiles";

/** Accept full local connectors or a sanitized capability list; never return credentials. */
export type GenerationConnector = Pick<ConnectorConfig, "id" | "definitionId"> & { configured?: boolean; apiKey?: string };
export interface GenerationRecommendation {
  source: "explicit" | "project" | "global" | "ai" | "none";
  /** ready validates configuration only; submission must still validate real inputs and target. */
  status: "ready" | "ambiguous" | "needs-selection";
  recommendation?: GenerationSelection;
  draft?: Partial<GenerationSelection>;
  candidateConnectorIds: string[];
  issues: string[];
}
const selectionSchema = generationSubmitSchema.pick({ connectorId: true, model: true, parameters: true }).strict();
const preferenceParametersSchema = generationSubmitSchema.shape.parameters.removeDefault().omit({ mode: true }).strict();
const preferenceSchema = selectionSchema.extend({ parameters: preferenceParametersSchema.default({}) }).strict();
const configured = (connector: GenerationConnector) => connector.configured ?? Boolean(connector.apiKey?.trim());

function validateSelection(kind: MediaKind, raw: unknown, connectors: readonly GenerationConnector[]): GenerationSelection {
  const selection = selectionSchema.parse(raw);
  const connector = connectors.find((item) => item.id === selection.connectorId);
  if (!connector || !configured(connector)) throw new Error("所选供应商连接已删除或尚未配置，请重新选择");
  if (connector.definitionId !== "apimart" && connector.definitionId !== "aihubmix") throw new Error("当前供应商暂不支持已验证的图片／视频生成配置");
  // Parameter-only validation uses local fixture roles, never stores/submits them.
  // Real input presence, ownership, size and mode remain the submission boundary's job.
  const mode = selection.parameters.mode ?? "text";
  profileRequest({ ...selection, prompt: "参数配置校验", target: kind === "video"
    ? { kind: "shot", projectId: "validation", episodeId: "validation", entityId: "validation", slot: "clip" }
    : { kind: "character", projectId: "validation", entityId: "validation", slot: "front" },
    inputs: kind === "image" || mode === "text" ? [] : [{ mediaId: "validation", role: mode === "frames" ? "first-frame" : "reference-image" }],
  }, connector.definitionId);
  return structuredClone(selection);
}

/** Strict save/read validation; context-dependent input mode is deliberately not remembered. */
export function validateGenerationPreference(kind: MediaKind, raw: unknown, connectors: readonly GenerationConnector[]): GenerationPreference {
  if (kind !== "image" && kind !== "video") throw new Error("生成偏好类型无效");
  const preference = preferenceSchema.parse(raw);
  if (preference.parameters.aspectRatio === "adaptive") throw new Error("跟随输入图片的比例仅适用于本次生成，请不要存为全局默认");
  return validateSelection(kind, preference, connectors) as GenerationPreference;
}

/** Invalid persisted choices stay in storage for explicit repair, never silently replaced. */
export function inspectGenerationPreferences(raw: unknown, connectors: readonly GenerationConnector[]): GenerationPreferenceState {
  if (raw === undefined) return { preferences: {}, issues: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { preferences: {}, issues: { image: ["保存的生成偏好格式无效，请清除或重新保存"], video: ["保存的生成偏好格式无效，请清除或重新保存"] } };
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "image" && key !== "video")) return { preferences: {}, issues: { image: ["保存的生成偏好包含不支持的字段，请重新保存"], video: ["保存的生成偏好包含不支持的字段，请重新保存"] } };
  const state: GenerationPreferenceState = { preferences: {}, issues: {} };
  for (const kind of ["image", "video"] as const) {
    if (record[kind] === undefined) continue;
    try { state.preferences[kind] = validateGenerationPreference(kind, record[kind], connectors); }
    catch (error) { state.issues[kind] = [preferenceError(error)]; }
  }
  return state;
}
function preferenceError(error: unknown): string {
  // Schema details can repeat user-provided unknown field names; show only safe diagnosis.
  return error instanceof z.ZodError ? "配置字段或参数格式无效，请重新选择" : error instanceof Error ? error.message : "生成配置无效，请重新选择";
}

/** Independent recommendation only. Does not merge into or mutate the AI/user draft. */
export function recommendGenerationSelection(input: {
  kind: MediaKind;
  connectors: readonly GenerationConnector[];
  projectDefaults?: ProjectGenerationDefaults;
  preferences?: GenerationPreferences;
  preferenceIssues?: GenerationPreferenceState["issues"];
  aiSuggestion?: GenerationSelection;
  explicitSelection?: GenerationSelection;
}): GenerationRecommendation {
  const { kind, connectors } = input;
  const valid = (source: GenerationRecommendation["source"], candidate: GenerationSelection): GenerationRecommendation => {
    try { return { source, status: "ready", recommendation: validateSelection(kind, candidate, connectors), candidateConnectorIds: [candidate.connectorId], issues: [] }; }
    catch (error) { return { source, status: "needs-selection", candidateConnectorIds: [], issues: [preferenceError(error)] }; }
  };
  if (input.explicitSelection !== undefined) return valid("explicit", input.explicitSelection);
  const project = input.projectDefaults?.[kind];
  if (project !== undefined) {
    const errors = validateGenerationDefaults({ [kind]: project });
    if (errors.length) return { source: "project", status: "needs-selection", candidateConnectorIds: [], issues: errors };
    const candidates = connectors.filter((connector) => connector.definitionId === project.provider && configured(connector));
    const image = input.projectDefaults?.image;
    const parameters = kind === "image" && image
      ? {
        size: image.size, resolution: image.resolution,
        ...(image.quality ? { quality: image.quality as GenerationSelection["parameters"]["quality"] } : {}),
        ...(image.version ? { version: image.version as GenerationSelection["parameters"]["version"] } : {}),
      }
      : input.projectDefaults?.video ? { mode: input.projectDefaults.video.mode as "text" | "frames" | "reference", aspectRatio: input.projectDefaults.video.aspectRatio, resolution: input.projectDefaults.video.resolution, duration: input.projectDefaults.video.duration } : {};
    const draft = { model: project.model, parameters };
    if (candidates.length !== 1) return { source: "project", status: candidates.length > 1 ? "ambiguous" : "needs-selection", draft,
      candidateConnectorIds: candidates.map((connector) => connector.id), issues: [candidates.length > 1 ? "项目有多个可用的 APIMart 连接，请明确选择本次使用的连接" : "项目默认使用 APIMart，但当前没有已配置的 APIMart 连接"] };
    return valid("project", { ...draft, connectorId: candidates[0]!.id });
  }
  if (input.preferenceIssues?.[kind]?.length) return { source: "global", status: "needs-selection", candidateConnectorIds: [], issues: [...input.preferenceIssues[kind]!] };
  if (input.preferences?.[kind] !== undefined) {
    try { return valid("global", validateGenerationPreference(kind, input.preferences[kind], connectors)); }
    catch (error) { return { source: "global", status: "needs-selection", candidateConnectorIds: [], issues: [preferenceError(error)] }; }
  }
  if (input.aiSuggestion !== undefined) return valid("ai", input.aiSuggestion);
  return { source: "none", status: "needs-selection", candidateConnectorIds: [], issues: ["尚未选择图片／视频生成配置，请选择供应商、模型和参数"] };
}
