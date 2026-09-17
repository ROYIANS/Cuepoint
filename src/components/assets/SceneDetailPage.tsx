import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchScene, setSceneSlot } from "@/db/repo";
import { SCENE_SLOTS } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SceneDetailPage({
  projectId,
  sceneId,
}: {
  projectId: string;
  sceneId: string;
}) {
  const navigate = useNavigate();
  const scene = useLiveQuery(() => db.scenes.get(sceneId), [sceneId]);

  if (scene === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载中…</div>;
  }
  if (!scene || scene.projectId !== projectId) {
    return (
      <div className="p-8">
        <p>找不到这个场景</p>
        <Button
          className="mt-3"
          onClick={() => void navigate({ to: "/p/$projectId/assets", params: { projectId } })}
        >
          返回资产库
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
        <Link
          to="/p/$projectId/assets"
          params={{ projectId }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" /> 资产库
        </Link>
        <h1 className="mt-3 text-lg font-semibold">场景</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-2 gap-4">
            {SCENE_SLOTS.map((slot) => (
              <EditableGenerationSlot
                key={slot.id}
                projectId={projectId}
                label={slot.label}
                title={`场景 · ${slot.label}`}
                variant="asset"
                slot={scene.slots?.[slot.id]}
                onSave={(value) => void setSceneSlot(scene.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <Field label="名称">
              <Input
                value={scene.name}
                onChange={(event) => void patchScene(scene.id, { name: event.target.value })}
              />
            </Field>
            <Field label="地点">
              <Input
                value={scene.location}
                onChange={(event) => void patchScene(scene.id, { location: event.target.value })}
              />
            </Field>
            <Field label="时段">
              <Input
                value={scene.timeOfDay}
                onChange={(event) => void patchScene(scene.id, { timeOfDay: event.target.value })}
                placeholder="日 / 夜 / 黄昏"
              />
            </Field>
            <Field label="氛围">
              <Input
                value={scene.atmosphere}
                onChange={(event) => void patchScene(scene.id, { atmosphere: event.target.value })}
              />
            </Field>
            <Field label="备注">
              <Textarea
                value={scene.notes}
                onChange={(event) => void patchScene(scene.id, { notes: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
