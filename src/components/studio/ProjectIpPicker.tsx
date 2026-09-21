import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Selection only; the caller commits the validated project binding with its own save action. */
export function ProjectIpPicker({ value, onChange, disabled = false }: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const view = useLiveQuery(async () => {
    try { return { profiles: await db.ipProfiles.orderBy("updatedAt").reverse().toArray() }; }
    catch { return { error: "IP 档案读取失败，请稍后重试。" }; }
  }, []);
  const profiles = view?.profiles?.filter(profile => !profile.archived || profile.id === value) ?? [];
  return <div className="min-w-0 space-y-2">
    <Select value={value ?? "independent"} disabled={disabled || !view || Boolean(view.error)} onValueChange={next => onChange(next === "independent" ? null : next)}>
      <SelectTrigger aria-label="所属 IP" className="w-full min-w-0"><SelectValue placeholder="选择所属 IP" /></SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-32px)]">
        <SelectItem value="independent">独立项目 · 不关联 IP</SelectItem>
        {value && view?.profiles && !profiles.some(profile => profile.id === value) && <SelectItem value={value} disabled>原 IP 已不可用</SelectItem>}
        {profiles.map(profile => <SelectItem key={profile.id} value={profile.id} disabled={profile.archived}><span className="min-w-0 whitespace-normal break-words">{profile.name}{profile.archived ? "（已归档，保留原关联）" : ""}</span></SelectItem>)}
      </SelectContent>
    </Select>
    {!view && <p className="text-muted-foreground text-xs" role="status">正在读取 IP…</p>}
    {view?.error && <p className="text-destructive text-xs" role="alert">{view.error}</p>}
  </div>;
}
