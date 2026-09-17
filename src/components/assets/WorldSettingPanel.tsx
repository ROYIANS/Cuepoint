import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { db } from "@/db/database";
import { updateProject } from "@/db/repo";
import { emptySetting, normalizeSetting, type WorldSetting } from "@/domain/types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FIELDS: { key: keyof WorldSetting; label: string; hint: string; placeholder: string }[] = [
  {
    key: "worldview",
    label: "世界观",
    hint: "这部宇宙怎么运转。时代、力量从哪来、人和世界的关系。",
    placeholder: "这是一个怎样的世界",
  },
  {
    key: "background",
    label: "背景",
    hint: "开拍之前已经为真的事。历史、势力、这个地方为什么是现在这样。",
    placeholder: "开场之前，已经发生过什么",
  },
  {
    key: "rules",
    label: "规则",
    hint: "不能破的戏规。生成资产和分镜时要守住的边界。",
    placeholder: "什么可以发生，什么绝对不行",
  },
];

export function WorldSettingPanel({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const [setting, setSetting] = useState<WorldSetting>(emptySetting());
  const [saved, setSaved] = useState(true);
  const loadedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!project || loadedFor.current === project.id) return;
    loadedFor.current = project.id;
    setSetting(normalizeSetting(project.setting));
    setSaved(true);
  }, [project]);

  useEffect(() => {
    if (!project || loadedFor.current !== project.id || saved) return;
    const handle = window.setTimeout(() => {
      void updateProject(projectId, { setting }).then(() => setSaved(true));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [project, projectId, saved, setting]);

  if (!project) {
    return <p className="text-muted-foreground mt-6 text-sm">加载设定…</p>;
  }

  return (
    <div className="mt-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <p className="text-muted-foreground text-xs leading-5">
          设定是这部戏一直为真的东西，不跟某一集走。
        </p>
        <p className="text-muted-foreground text-[11px]">{saved ? "已保存" : "保存中…"}</p>
      </div>
      <div className="mt-5 space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <Label>{field.label}</Label>
            <p className="text-muted-foreground mt-1 text-[11px] leading-5">{field.hint}</p>
            <Textarea
              className="mt-2 min-h-36 resize-y bg-card/60"
              value={setting[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => {
                setSetting({ ...setting, [field.key]: event.target.value });
                setSaved(false);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
