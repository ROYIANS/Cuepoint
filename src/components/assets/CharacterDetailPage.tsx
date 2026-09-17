import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchCharacter, setCharacterSlot } from "@/db/repo";
import { CHARACTER_SLOTS } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CharacterDetailPage({
  projectId,
  characterId,
}: {
  projectId: string;
  characterId: string;
}) {
  const navigate = useNavigate();
  const character = useLiveQuery(() => db.characters.get(characterId), [characterId]);

  if (character === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载中…</div>;
  }
  if (!character || character.projectId !== projectId) {
    return (
      <div className="p-8">
        <p>找不到这个角色</p>
        <Button
          className="mt-3"
          onClick={() => void navigate({ to: "/p/$projectId/world", params: { projectId } })}
        >
          返回世界
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
        <Link
          to="/p/$projectId/world"
          params={{ projectId }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" /> 世界
        </Link>
        <h1 className="mt-3 text-lg font-semibold">角色</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-2 gap-4">
            {CHARACTER_SLOTS.map((slot) => (
              <EditableGenerationSlot
                key={slot.id}
                projectId={projectId}
                label={slot.label}
                title={`角色 · ${slot.label}`}
                variant="asset"
                slot={character.slots?.[slot.id]}
                onSave={(value) => void setCharacterSlot(character.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <Field label="名称">
              <Input
                value={character.name}
                onChange={(event) => void patchCharacter(character.id, { name: event.target.value })}
              />
            </Field>
            <Field label="简介">
              <Textarea
                value={character.bio}
                onChange={(event) => void patchCharacter(character.id, { bio: event.target.value })}
              />
            </Field>
            <Field label="外观说明">
              <Textarea
                value={character.appearance}
                onChange={(event) =>
                  void patchCharacter(character.id, { appearance: event.target.value })
                }
              />
            </Field>
            <Field label="备注">
              <Textarea
                value={character.notes}
                onChange={(event) => void patchCharacter(character.id, { notes: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
