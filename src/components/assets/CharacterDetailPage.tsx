import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchCharacter, setCharacterSlot } from "@/db/repo";
import { CHARACTER_SLOTS } from "@/domain/types";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { AssetTextField } from "./AssetTextField";
import { Button } from "@/components/ui/button";

export function CharacterDetailPage({
  characterId,
  back,
}: {
  characterId: string;
  back: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
  const navigate = useNavigate();
  const character = useLiveQuery(
    async () => (await db.characters.get(characterId)) ?? null,
    [characterId],
  );

  if (character === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载中…</div>;
  }
  const missing =
    character === null || (back.kind === "project" && character.projectId !== back.projectId);
  if (missing) {
    return (
      <div className="p-8">
        <p>找不到这个角色</p>
        <Button className="mt-3" onClick={() => void goBack(navigate, back)}>
          {back.kind === "studio" ? "返回角色库" : "返回世界"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-6">
        {back.kind === "studio" ? (
          <Link
            to="/characters"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> 角色设定
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
        <h1 className="mt-3 text-lg font-semibold">角色</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid grid-cols-2 gap-4">
            {CHARACTER_SLOTS.map((slot) => (
              <EditableGenerationSlot
                key={slot.id}
                projectId={character.projectId}
                label={slot.label}
                title={`角色 · ${slot.label}`}
                variant="asset"
                slot={character.slots?.[slot.id]}
                onSave={(value) => setCharacterSlot(character.id, slot.id, value)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <AssetTextField
              key={`${character.id}:name`}
              draftKey={`${character.id}:name`}
              label="名称"
              value={character.name}
              projectId={character.projectId}
              persist={(value) => patchCharacter(character.id, { name: value })}
            />
            <AssetTextField
              key={`${character.id}:bio`}
              draftKey={`${character.id}:bio`}
              label="简介"
              value={character.bio}
              projectId={character.projectId}
              persist={(value) => patchCharacter(character.id, { bio: value })}
              multiline
            />
            <AssetTextField
              key={`${character.id}:appearance`}
              draftKey={`${character.id}:appearance`}
              label="外观说明"
              value={character.appearance}
              projectId={character.projectId}
              persist={(value) => patchCharacter(character.id, { appearance: value })}
              multiline
            />
            <AssetTextField
              key={`${character.id}:notes`}
              draftKey={`${character.id}:notes`}
              label="备注"
              value={character.notes}
              projectId={character.projectId}
              persist={(value) => patchCharacter(character.id, { notes: value })}
              multiline
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function goBack(
  navigate: ReturnType<typeof useNavigate>,
  back: { kind: "studio" } | { kind: "project"; projectId: string },
) {
  if (back.kind === "studio") return navigate({ to: "/characters" });
  return navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId } });
}
