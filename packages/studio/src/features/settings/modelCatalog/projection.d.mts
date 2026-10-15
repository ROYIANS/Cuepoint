export interface ProjectionScope {
    recentMonths: number;
    fullProviders: readonly string[];
    originProviders: readonly string[];
}

interface RawModel {
    id: string;
    name: string;

    [key: string]: unknown;
}

export interface RawProvider {
    api?: unknown;
    models: Record<string, RawModel>;
}

export interface ProjectedEntry {
    provider: string;
    id: string;
    name: string;
    canonicalId?: string;
    context?: number;
    output?: number;
    imageInput?: boolean;
    reasoning?: boolean;
    toolCall?: boolean;
    cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
    releaseDate?: string;
}

export function projectEntry(provider: string, model: RawModel): ProjectedEntry;

export function originOf(api: string): string | undefined;

export function compareEntries(a: ProjectedEntry, b: ProjectedEntry): number;

export function projectCommonScope(
    providers: Record<string, RawProvider>, scope: ProjectionScope, now: string,
): { entries: ProjectedEntry[]; providerOrigins: Record<string, string> };

export function projectBaseline(
    input: { providers: Record<string, RawProvider>; snapshotGeneratedAt: string; packageVersion: string },
    scope: ProjectionScope, format: number,
): {
    format: number;
    packageVersion: string;
    snapshotGeneratedAt: string;
    providerOrigins: Record<string, string>;
    entries: ProjectedEntry[]
};
