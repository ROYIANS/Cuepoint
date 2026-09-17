import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchStyle, setStyleSlot } from "@/db/repo";
import { STYLE_SLOTS } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    style === null || (back.kind === "project" && style.projectId !== back.projectId);
  if (missing) {
    return (
      <div className="p-8">
        <p>找不到这个风格</p>
        <Button
          className="mt-3"
          onClick={() =>
            void (back.kind === "studio"
              ? navigate({ to: "/styles" })
              : navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId } }))
          }
        >
          {back.kind === "studio" ? "返回风格库" : "返回世界"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
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
                onSave={(value) => void setStyleSlot(style.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <Field label="名称">
              <Input
                value={style.name}
                onChange={(event) => void patchStyle(style.id, { name: event.target.value })}
              />
            </Field>
            <Field label="备注">
              <Textarea
                value={style.notes}
                placeholder="画风、光色、镜头气质"
                onChange={(event) => void patchStyle(style.id, { notes: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
