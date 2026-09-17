import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchProp, setPropSlot } from "@/db/repo";
import { PROP_SLOTS } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    prop === null || (back.kind === "project" && prop.projectId !== back.projectId);
  if (missing) {
    return (
      <div className="p-8">
        <p>找不到这个道具</p>
        <Button
          className="mt-3"
          onClick={() =>
            void (back.kind === "studio"
              ? navigate({ to: "/props" })
              : navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId } }))
          }
        >
          {back.kind === "studio" ? "返回道具库" : "返回世界"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
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
                onSave={(value) => void setPropSlot(prop.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <Field label="名称">
              <Input
                value={prop.name}
                onChange={(event) => void patchProp(prop.id, { name: event.target.value })}
              />
            </Field>
            <Field label="类型">
              <Input
                value={prop.kind}
                placeholder="衣服、车、物件…"
                onChange={(event) => void patchProp(prop.id, { kind: event.target.value })}
              />
            </Field>
            <Field label="备注">
              <Textarea
                value={prop.notes}
                onChange={(event) => void patchProp(prop.id, { notes: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
