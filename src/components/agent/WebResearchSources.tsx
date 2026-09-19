import type { AgentToolCall } from '@/domain/agent';
import { webResultSources } from '@/domain/search';

export function WebResearchSources({ call }: { call: AgentToolCall }) {
  const result = webResultSources(call.name, call.result);
  if (!result) return null;
  return <section className="min-w-0 space-y-2 py-2 text-xs" aria-label="联网调研来源">
    <p className="text-muted-foreground break-words">{result.note}</p>
    {result.sources.length > 0 && <ol className="space-y-3">{result.sources.map((source, index) => <li key={`${source.id}-${index}`} className="min-w-0">
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 break-words focus-visible:outline focus-visible:outline-2">{source.title} ↗</a>
      <p className="text-muted-foreground mt-1 break-all">{source.url}</p>
      {source.publishedAt && <p className="text-muted-foreground">来源标注日期：{source.publishedAt}</p>}
      {source.snippet && <p className="mt-1 whitespace-pre-wrap break-words leading-5">{source.snippet}</p>}
    </li>)}</ol>}
  </section>;
}
