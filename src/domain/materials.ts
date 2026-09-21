import type { Character, Scene, Prop, VisualStyle, MediaRecord } from './types';

export interface IpProfile {
  id: string; name: string; positioning: string; audience: string; topics: string;
  expression: string; visual: string; voice: string; revision: number;
  archived: boolean; createdAt: string; updatedAt: string;
}
export type IpProfileInput = Pick<IpProfile, 'name'> & Partial<Pick<IpProfile, 'positioning' | 'audience' | 'topics' | 'expression' | 'visual' | 'voice'>>;
export interface ProjectIpLink { projectId: string; ipId: string; updatedAt: string }
export type MaterialScope = { kind: 'global' } | { kind: 'ip'; id: string } | { kind: 'project'; id: string };
export type SettingMaterialKind = 'character' | 'scene' | 'prop' | 'style';
export type MaterialKind = 'image' | 'video' | 'audio' | 'document' | SettingMaterialKind;
export type MaterialEntity = Character | Scene | Prop | VisualStyle;
export interface LibraryMaterial {
  id: string; name: string; kind: MaterialKind; scope: MaterialScope; revision: number;
  archived: boolean; notes: string; tags: string[]; createdAt: string; updatedAt: string;
  source?: { projectId?: string; entityId?: string; materialId?: string; revision?: number };
}
export type MaterialPayload = { type: 'file'; blob: Blob; filename: string; mimeType: string }
  | { type: 'setting'; kind: SettingMaterialKind; entity: MaterialEntity; media: MediaRecord[] };
export interface MaterialVersion { id: string; materialId: string; revision: number; payload: MaterialPayload; createdAt: string }
export interface MaterialUse {
  id: string; materialId: string; revision: number; projectId: string;
  targetKind: 'media' | SettingMaterialKind; targetId: string; mediaIds: string[];
  createdAt: string; updatedAt: string; targetFingerprint?: string;
  /** Prior uses remain durable references after an explicit version update. */
  supersededBy?: string;
}
export interface MaterialEvent { id: string; materialId: string; action: string; createdAt: string; detail: string }
