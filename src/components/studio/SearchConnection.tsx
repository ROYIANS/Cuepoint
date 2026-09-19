import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { getSearchConnectionState, removeSearchConnection, saveSearchConnection } from '@/db/searchConnections';
import { testSearchConnection } from '@/lib/ai/tavily';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function SearchConnection() {
  const state = useLiveQuery(getSearchConnectionState, []);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  async function act(action: 'save' | 'remove' | 'test') {
    setBusy(true); setFeedback('');
    try {
      if (action === 'test') { const result = await testSearchConnection(key); setFeedback(result.message); }
      else {
        if (action === 'save') await saveSearchConnection({ apiKey: key, enabled });
        else await removeSearchConnection();
        setKey(''); setOpen(false); toast.success(action === 'save' ? '已保存搜索连接' : '已移除搜索连接');
      }
    } catch { setFeedback('操作失败，请重试；填写的内容已保留'); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 border-t pt-6" aria-label="联网搜索">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1"><h2 className="text-base font-medium">联网搜索</h2><p className="text-muted-foreground mt-2 text-sm leading-6">Tavily · 为智能模式提供网络搜索与网页读取。单独配置密钥，使用当前对话模型分析资料。</p><p className="text-muted-foreground mt-1 text-xs">{state?.configured ? state.enabled ? '已配置 · 已启用' : '已配置 · 已停用' : '未配置'}</p></div>
      <Button variant="outline" size="sm" disabled={!state} onClick={() => { setKey(''); setEnabled(state?.enabled ?? true); if (!state?.configured) setEnabled(true); setFeedback(''); setOpen(true); }}>配置 Tavily</Button>
    </div>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); if (!value) setKey(''); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tavily 联网搜索</DialogTitle><DialogDescription>密钥仅保存在本机，不进入项目备份或 AI 上下文。保存不发送请求；测试仅查询鉴权，不执行搜索。</DialogDescription></DialogHeader>
        <Field label="Tavily API Key"><Input type="password" value={key} disabled={busy} onChange={(event) => setKey(event.target.value)} placeholder={state?.configured ? '已保存密钥（留空则保持）' : 'tvly-…'} autoComplete="off" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} />启用联网搜索</label>
        <p className="text-muted-foreground text-xs leading-5">启用后会为后续智能对话开启「联网调研」技能；你仍可在对话的技能菜单中关闭。搜索和读取网页可能消耗服务额度。</p>
        {feedback && <p role="status" className="text-sm leading-6">{feedback}</p>}
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {state?.configured && <Button variant="ghost" disabled={busy} onClick={() => void act('remove')}>移除搜索连接</Button>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void act('test')}>测试搜索连接</Button><Button disabled={busy || !key.trim() && !state?.configured} onClick={() => void act('save')}>保存搜索连接</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
