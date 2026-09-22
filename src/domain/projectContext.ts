export interface ProjectContextSnapshot {
  projectId: string;
  name: string;
  fingerprint: string;
  content: string;
  coverage: { episodes: { total: number; included: number }; assets: { total: number; included: number }; truncated: boolean; audio?: Record<string, { total: number; included: number }> };
}
