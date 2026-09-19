import type { ReferenceAttachment, ReferenceKind } from "./references";
/** Local identities only. Image bytes are resolved immediately before HTTP and never persisted here. */
export interface AgentImageReference {
  projectId: string;
  mediaId: string;
  filename: string;
  mimeType: string;
  size: number;
  reference?: ReferenceAttachment;
}
export interface AgentReferenceCoverage extends ReferenceAttachment {
  filename: string;
  kind: ReferenceKind;
  includedChunkIndices: number[];
  totalChunks: number;
  includedCharacters: number;
  partial: boolean;
  warnings: string[];
}
export interface AgentReferenceInput {
  projectId: string;
  references: ReferenceAttachment[];
  images?: AgentImageReference[];
  coverage?: AgentReferenceCoverage[];
}
export interface AgentSelectedReferences extends AgentReferenceInput { envelope: string }
export interface AgentVisionCapability {
  supported: boolean;
  source: "provider" | "model-bank" | "unknown";
  sourceUrl?: string;
}
export interface AgentReferenceAudit { step: number; preparedAt: string; inputs: AgentReferenceInput[] }

/** Strip frozen source text from lightweight wire identities and per-step audit records. */
export function referenceInputOf(selected: AgentSelectedReferences): AgentReferenceInput {
  return { projectId: selected.projectId, references: selected.references, images: selected.images, coverage: selected.coverage };
}
