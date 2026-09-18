import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchScene, setSceneSlot } from "@/db/repo";
import { SCENE_SLOTS } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { AssetTextField } from "./AssetTextField";
import { Button } from "@/components/ui/button";

export function SceneDetailPage({
  sceneId,
  back,
}: {
  sceneId: string;
  back: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
  const navigate = useNavigate();
  const scene = useLiveQuery(async () => (await db.scenes.get(sceneId)) ?? null, [sceneId]);

  if (scene === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载中…</div>;
  }
  const missing =
    scene === null || (back.kind === "project" && scene.projectId !== back.projectId);
  if (missing) {
    return (
      <div className="p-8">
        <p>找不到这个场景</p>
        <Button
          className="mt-3"
          onClick={() =>
            void (back.kind === "studio"
              ? navigate({ to: "/scenes" })
              : navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId } }))
          }
        >
          {back.kind === "studio" ? "返回场景库" : "返回世界"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
        {back.kind === "studio" ? (
          <Link
            to="/scenes"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 常用场景
          </Link>
        ) : (
          <Link
            to="/p/$projectId/world"
            params={{ projectId: back.projectId }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 世界
          </Link>
        )}
        <h1 className="mt-3 text-lg font-semibold">场景</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-2 gap-4">
            {SCENE_SLOTS.map((slot) => (
              <EditableGenerationSlot
                key={slot.id}
                projectId={scene.projectId}
                label={slot.label}
                title={`场景 · ${slot.label}`}
                variant="asset"
                slot={scene.slots?.[slot.id]}
                onSave={(value) => setSceneSlot(scene.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <AssetTextField
              key={`${scene.id}:name`}
              draftKey={`${scene.id}:name`}
              label="名称"
              value={scene.name}
              projectId={scene.projectId}
              persist={(value) => patchScene(scene.id, { name: value })}
            />
            <AssetTextField
              key={`${scene.id}:location`}
              draftKey={`${scene.id}:location`}
              label="地点"
              value={scene.location}
              projectId={scene.projectId}
              persist={(value) => patchScene(scene.id, { location: value })}
            />
            <AssetTextField
              key={`${scene.id}:timeOfDay`}
              draftKey={`${scene.id}:timeOfDay`}
              label="时段"
              value={scene.timeOfDay}
              projectId={scene.projectId}
              persist={(value) => patchScene(scene.id, { timeOfDay: value })}
              placeholder="日 / 夜 / 黄昏"
            />
            <AssetTextField
              key={`${scene.id}:atmosphere`}
              draftKey={`${scene.id}:atmosphere`}
              label="氛围"
              value={scene.atmosphere}
              projectId={scene.projectId}
              persist={(value) => patchScene(scene.id, { atmosphere: value })}
            />
            <AssetTextField
              key={`${scene.id}:notes`}
              draftKey={`${scene.id}:notes`}
              label="备注"
              value={scene.notes}
              projectId={scene.projectId}
              persist={(value) => patchScene(scene.id, { notes: value })}
              multiline
            />
          </div>
        </div>
      </div>
    </div>
  );
}
