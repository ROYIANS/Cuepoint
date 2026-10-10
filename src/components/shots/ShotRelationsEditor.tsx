import {useRef, useState} from "react";
import {patchShot} from "@/db/shots";
import type {Project, Prop, Shot, VisualStyle} from "@/domain/types";
import {shotRelations} from "@/lib/shotRelations";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

type ShotRelationPatch = Partial<Pick<Shot, "styleId" | "propIds">>;

export function ShotRelationsEditor({project, shot, props, styles, unavailable, onStatusChange}: {
    project: Project;
    shot: Shot;
    props: Prop[];
    styles: VisualStyle[];
    unavailable: boolean;
    onStatusChange: (status: "saved" | "saving" | "error") => void;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();
    const pending = useRef(false);
    const retryPatch = useRef<ShotRelationPatch | undefined>(undefined);
    const relations = shotRelations(project, shot, props, styles);
    const styleValue = shot.styleId === undefined ? "inherit" : shot.styleId === null ? "none" : shot.styleId;
    const defaultStyle = styles.find((item) => item.id === project.defaultStyleId);
    const missingPropIds = (shot.propIds ?? []).filter((id) => !props.some((item) => item.id === id));

    async function save(patch: ShotRelationPatch) {
        if (pending.current || unavailable) return;
        pending.current = true;
        setSaving(true);
        onStatusChange("saving");
        setError(undefined);
        retryPatch.current = patch;
        try {
            await patchShot(shot.id, patch);
            retryPatch.current = undefined;
            onStatusChange("saved");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "保存失败，请重试");
            onStatusChange("error");
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor={`shot-style-${shot.id}`}>镜头风格</Label>
                <Select value={styleValue} disabled={saving || unavailable}
                        onValueChange={(value) => void save({styleId: value === "inherit" ? undefined : value === "none" ? null : value})}>
                    <SelectTrigger id={`shot-style-${shot.id}`} className="w-full"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="inherit">继承项目
                            · {defaultStyle?.name ?? (project.defaultStyleId ? "默认风格已失效" : "未设默认风格")}</SelectItem>
                        <SelectItem value="none">不使用风格</SelectItem>
                        {shot.styleId && !styles.some((item) => item.id === shot.styleId) ?
                            <SelectItem value={shot.styleId} disabled>已失效的风格</SelectItem> : null}
                        {styles.map((style) => <SelectItem key={style.id}
                                                           value={style.id}>{style.name || "未命名风格"}</SelectItem>)}
                    </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">当前生效：{relations.style} · {relations.styleSource}</p>
            </div>
            <fieldset disabled={saving || unavailable} className="space-y-2">
                <legend className="mb-2 text-sm font-medium">镜头道具（可多选）</legend>
                {props.length === 0 ?
                    <p className="text-muted-foreground text-xs">先在世界的道具库中添加道具，再关联到镜头。</p> : (
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                            {props.map((prop) => (
                                <label key={prop.id}
                                       className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm">
                                    <Checkbox disabled={saving || unavailable}
                                              checked={(shot.propIds ?? []).includes(prop.id)}
                                              onCheckedChange={(checked) => {
                                                  const ids = new Set(shot.propIds ?? []);
                                                  if (checked) ids.add(prop.id); else ids.delete(prop.id);
                                                  void save({propIds: [...ids]});
                                              }}/>
                                    <span>{prop.name || "未命名道具"}</span>
                                </label>
                            ))}
                        </div>
                    )}
                {missingPropIds.length > 0 ? <div className="text-destructive text-xs">
                    有 {missingPropIds.length} 个道具关联已失效。
                    <Button size="sm" variant="ghost" disabled={saving || unavailable}
                            onClick={() => void save({propIds: (shot.propIds ?? []).filter((id) => !missingPropIds.includes(id))})}>移除失效关联</Button>
                </div> : null}
                <p className="text-muted-foreground text-xs">已关联：{relations.props || "无道具"}</p>
            </fieldset>
            <div role="status" aria-live="polite" className="text-muted-foreground text-xs">
                {saving ? "保存中…" : error ? (
                    <div className="text-destructive space-y-2">
                        <p>{error}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline"
                                    onClick={() => retryPatch.current && void save(retryPatch.current)}>重试</Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                                retryPatch.current = undefined;
                                setError(undefined);
                                onStatusChange("saved");
                            }}>放弃未保存的选择</Button>
                        </div>
                    </div>
                ) : "选择已保存"}
            </div>
        </div>
    );
}
