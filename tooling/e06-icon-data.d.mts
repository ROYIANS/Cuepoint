export interface CatalogEntry {icon: string; keywords: string[]; props?: Record<string, string | number | boolean>}
export interface CatalogData {version: string; inputs: Record<string,string>; model: CatalogEntry[]; provider: CatalogEntry[]}
export function catalogData(): Promise<CatalogData>;
export function generatedSource(data: CatalogData): string;
