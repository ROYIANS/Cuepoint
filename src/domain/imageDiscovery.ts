export type ImageEntityKind = 'shot' | 'character' | 'scene' | 'prop' | 'style';
export type ImageSourceKind = 'current' | 'reference' | 'candidate';
export type ImageSourceLocator =
  | { kind: 'slot'; entityKind: ImageEntityKind; entityId: string; slot: string; source: 'current' | 'reference'; mediaId?: string }
  | { kind: 'reference'; referenceId: string }
  | { kind: 'job'; jobId: string };
export interface DiscoveredImage {
  id: string; projectId: string; projectName: string; episodeId?: string; episodeTitle?: string;
  entityKind: ImageEntityKind | 'reference'; entityId: string; entityLabel: string;
  slot: string; slotLabel: string; source: ImageSourceKind; mediaId?: string; mimeType?: string;
  available: boolean; unavailableReason?: string; revision: string; locator: ImageSourceLocator;
  currentlyApplied?: boolean;
  target: { label: string; href: string };
}
export interface ImageDiscoveryResult {
  discoveryCallId: string; status: 'resolved' | 'ambiguous_project' | 'not_found';
  projects: Array<{ id: string; name: string }>; projectCount: number; candidates: DiscoveredImage[];
  total: number; offset: number; hasMore: boolean; note: string;
}
export interface ImageDiscoveryProvenance { discoveryCallId: string; candidateId: string; readCallId: string; mediaDigest: string }

/** Only code-owned result metadata becomes a source link; no HTML or pixel auto-load. */
export function projectImageSources(name: string, result?: string): DiscoveredImage[] {
  if (!['discover_project_images', 'read_project_image'].includes(name) || !result) return [];
  try {
    const value = JSON.parse(result) as { candidates?: unknown[]; source?: unknown };
    const rows = name === 'discover_project_images' ? value.candidates : value.source ? [value.source] : [];
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 20).filter((raw): raw is DiscoveredImage => {
      if (!raw || typeof raw !== 'object') return false;
      const row = raw as DiscoveredImage;
      return [row.id, row.projectName, row.entityLabel, row.slotLabel].every((item) => typeof item === 'string') && ['current', 'reference', 'candidate'].includes(row.source) && typeof row.target?.href === 'string' && /^\/p\/(?!\/)/.test(row.target.href);
    });
  } catch { return []; }
}
