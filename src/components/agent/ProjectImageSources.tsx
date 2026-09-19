import { Link } from '@tanstack/react-router';
import type { AgentToolCall } from '@/domain/agent';
import { projectImageSources } from '@/domain/imageDiscovery';

const labels = { current: '当前结果', reference: '参考图', candidate: '已保存候选' };
export function ProjectImageSources({ call }: { call: AgentToolCall }) {
  const sources = projectImageSources(call.name, call.result);
  if (!sources.length) return null;
  return <section aria-label="项目图片来源" className="min-w-0 space-y-2 py-2 text-xs">
    <p className="text-muted-foreground">{call.name === 'read_project_image' ? '已准备图片，视觉分析由当前模型在后续回复中完成。' : '找到以下图片身份，尚未读取像素。'}</p>
    <ul className="space-y-3">{sources.map((source) => <li key={source.id} className="min-w-0">
      <Link to={source.target.href} className="underline underline-offset-4 break-words focus-visible:outline focus-visible:outline-2">{source.projectName} · {source.episodeTitle ? `${source.episodeTitle} · ` : ''}{source.entityLabel} · {source.slotLabel} ↗</Link>
      <p className="text-muted-foreground mt-1">{labels[source.source]}{source.source === 'candidate' ? source.currentlyApplied ? ' · 当前已写入' : ' · 当前未写入' : ''} · {source.available ? '查找时可用' : source.unavailableReason ?? '不可用'}</p>
    </li>)}</ul>
  </section>;
}
