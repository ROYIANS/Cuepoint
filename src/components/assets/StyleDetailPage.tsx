import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchStyle, setStyleSlot } from "@/db/repo";
import { STYLE_SLOTS, STUDIO_LIBRARY_ID } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { AssetTextField } from "./AssetTextField";
import { Button } from "@/components/ui/button";

export function StyleDetailPage({
  styleId,
  back = { kind: "studio" },
}: {
  styleId: string;
  back?: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
  const navigate = useNavigate();
  const style = useLiveQuery(async () => (await db.styles.get(styleId)) ?? null, [styleId]);

  if (style === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载中…</div>;
  }
  const missing =
    style === null || style.projectId !== (back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID);
  if (missing) {
    return (
      <div className="p-8">
        <p>找不到这个风格</p>
        <Button
          className="mt-3"
          onClick={() =>
            void (back.kind === "studio"
              ? navigate({ to: "/styles" })
              : navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId }, search: { tab: "styles" } }))
          }
        >
          {back.kind === "studio" ? "返回风格库" : "返回世界"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {back.kind === "studio" ? (
          <Link
            to="/styles"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 视觉风格
          </Link>
        ) : (
          <Link
            to="/p/$projectId/world"
            params={{ projectId: back.projectId }}
            search={{ tab: "styles" }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 世界
          </Link>
        )}
        <h1 className="mt-3 text-lg font-semibold">风格</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-2 gap-4">
            {STYLE_SLOTS.map((slot) => (
              <EditableGenerationSlot
                key={slot.id}
                projectId={style.projectId}
                label={slot.label}
                title={`风格 · ${slot.label}`}
                variant="asset"
                slot={style.slots?.[slot.id]}
                onSave={(value) => setStyleSlot(style.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <AssetTextField
              key={`${style.id}:name`}
              draftKey={`${style.id}:name`}
              label="名称"
              value={style.name}
              projectId={style.projectId}
              persist={(value, baseline) => patchStyle(style.id, { name: value }, { name: baseline })}
            />
            <AssetTextField
              key={`${style.id}:notes`}
              draftKey={`${style.id}:notes`}
              label="备注"
              value={style.notes}
              projectId={style.projectId}
              persist={(value, baseline) => patchStyle(style.id, { notes: value }, { notes: baseline })}
              multiline
              placeholder="画风、光色、镜头气质"
            />
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">创作细节 · 选填</summary>
              <p className="text-muted-foreground mt-2 text-xs leading-5">把色彩、光影与构图方向写清楚，作为整部作品的视觉依据。所有信息均为选填。</p>
              <div className="mt-4 space-y-4">
                <AssetTextField
                  key={`${style.id}:palette`}
                  draftKey={`${style.id}:palette`}
                  label="色彩方案"
                  value={style.palette ?? ""}
                  projectId={style.projectId}
                  persist={(value, baseline) => patchStyle(style.id, { palette: value }, { palette: baseline })}
                  placeholder="主色、辅助色、饱和度与色彩关系"
                  multiline
                />
                <AssetTextField
                  key={`${style.id}:lighting`}
                  draftKey={`${style.id}:lighting`}
                  label="光影风格"
                  value={style.lighting ?? ""}
                  projectId={style.projectId}
                  persist={(value, baseline) => patchStyle(style.id, { lighting: value }, { lighting: baseline })}
                  placeholder="柔硬、反差、色温与阴影"
                  multiline
                />
                <AssetTextField
                  key={`${style.id}:lens`}
                  draftKey={`${style.id}:lens`}
                  label="镜头气质"
                  value={style.lens ?? ""}
                  projectId={style.projectId}
                  persist={(value, baseline) => patchStyle(style.id, { lens: value }, { lens: baseline })}
                  placeholder="焦段倾向、景深、畸变与颗粒"
                  multiline
                />
                <AssetTextField
                  key={`${style.id}:composition`}
                  draftKey={`${style.id}:composition`}
                  label="构图原则"
                  value={style.composition ?? ""}
                  projectId={style.projectId}
                  persist={(value, baseline) => patchStyle(style.id, { composition: value }, { composition: baseline })}
                  placeholder="画面重心、留白、对称与层次"
                  multiline
                />
                <AssetTextField
                  key={`${style.id}:negativePrompt`}
                  draftKey={`${style.id}:negativePrompt`}
                  label="避免出现"
                  value={style.negativePrompt ?? ""}
                  projectId={style.projectId}
                  persist={(value, baseline) => patchStyle(style.id, { negativePrompt: value }, { negativePrompt: baseline })}
                  placeholder="不希望出现的颜色、质感、构图或元素"
                  multiline
                />
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
