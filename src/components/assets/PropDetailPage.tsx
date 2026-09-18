import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchProp, setPropSlot } from "@/db/repo";
import { PROP_SLOTS, STUDIO_LIBRARY_ID } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { AssetTextField } from "./AssetTextField";
import { Button } from "@/components/ui/button";

export function PropDetailPage({
  propId,
  back = { kind: "studio" },
}: {
  propId: string;
  back?: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
  const navigate = useNavigate();
  const prop = useLiveQuery(async () => (await db.props.get(propId)) ?? null, [propId]);

  if (prop === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载中…</div>;
  }
  const missing =
    prop === null || prop.projectId !== (back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID);
  if (missing) {
    return (
      <div className="p-8">
        <p>找不到这个道具</p>
        <Button
          className="mt-3"
          onClick={() =>
            void (back.kind === "studio"
              ? navigate({ to: "/props" })
              : navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId }, search: { tab: "props" } }))
          }
        >
          {back.kind === "studio" ? "返回道具库" : "返回世界"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {back.kind === "studio" ? (
          <Link
            to="/props"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 道具
          </Link>
        ) : (
          <Link
            to="/p/$projectId/world"
            params={{ projectId: back.projectId }}
            search={{ tab: "props" }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 世界
          </Link>
        )}
        <h1 className="mt-3 text-lg font-semibold">道具</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-2 gap-4">
            {PROP_SLOTS.map((slot) => (
              <EditableGenerationSlot
                key={slot.id}
                projectId={prop.projectId}
                label={slot.label}
                title={`道具 · ${slot.label}`}
                variant="asset"
                slot={prop.slots?.[slot.id]}
                onSave={(value) => setPropSlot(prop.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <AssetTextField
              key={`${prop.id}:name`}
              draftKey={`${prop.id}:name`}
              label="名称"
              value={prop.name}
              projectId={prop.projectId}
              persist={(value) => patchProp(prop.id, { name: value })}
            />
            <AssetTextField
              key={`${prop.id}:kind`}
              draftKey={`${prop.id}:kind`}
              label="类型"
              value={prop.kind}
              projectId={prop.projectId}
              persist={(value) => patchProp(prop.id, { kind: value })}
              placeholder="衣服、车、物件…"
            />
            <AssetTextField
              key={`${prop.id}:notes`}
              draftKey={`${prop.id}:notes`}
              label="备注"
              value={prop.notes}
              projectId={prop.projectId}
              persist={(value) => patchProp(prop.id, { notes: value })}
              multiline
            />
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">创作细节 · 选填</summary>
              <p className="text-muted-foreground mt-2 text-xs leading-5">记录外观、使用方式和连续性，方便镜头之间保持一致。所有信息均为选填。</p>
              <div className="mt-4 space-y-4">
                <AssetTextField
                  key={`${prop.id}:appearance`}
                  draftKey={`${prop.id}:appearance`}
                  label="外观特征"
                  value={prop.appearance ?? ""}
                  projectId={prop.projectId}
                  persist={(value) => patchProp(prop.id, { appearance: value })}
                  placeholder="形状、颜色、纹理与辨识细节"
                  multiline
                />
                <AssetTextField
                  key={`${prop.id}:material`}
                  draftKey={`${prop.id}:material`}
                  label="材质"
                  value={prop.material ?? ""}
                  projectId={prop.projectId}
                  persist={(value) => patchProp(prop.id, { material: value })}
                  placeholder="金属、木质、织物，以及表面质感"
                  multiline
                />
                <AssetTextField
                  key={`${prop.id}:size`}
                  draftKey={`${prop.id}:size`}
                  label="尺寸与比例"
                  value={prop.size ?? ""}
                  projectId={prop.projectId}
                  persist={(value) => patchProp(prop.id, { size: value })}
                  placeholder="实际尺寸或与人物、环境的相对比例"
                  multiline
                />
                <AssetTextField
                  key={`${prop.id}:usage`}
                  draftKey={`${prop.id}:usage`}
                  label="使用方式"
                  value={prop.usage ?? ""}
                  projectId={prop.projectId}
                  persist={(value) => patchProp(prop.id, { usage: value })}
                  placeholder="谁使用、如何拿取、如何参与动作"
                  multiline
                />
                <AssetTextField
                  key={`${prop.id}:continuity`}
                  draftKey={`${prop.id}:continuity`}
                  label="连续性要求"
                  value={prop.continuity ?? ""}
                  projectId={prop.projectId}
                  persist={(value) => patchProp(prop.id, { continuity: value })}
                  placeholder="磨损、摆放、状态变化及需保持一致的细节"
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
