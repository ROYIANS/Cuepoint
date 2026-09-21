import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db/database";
import { patchCharacter, setCharacterSlot } from "@/db/repo";
import { CHARACTER_SLOTS, STUDIO_LIBRARY_ID } from "@/domain/types";
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
    character === null || character.projectId !== (back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID);
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
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
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
            search={{ tab: "characters" }}
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
              persist={(value, baseline) => patchCharacter(character.id, { name: value }, { name: baseline })}
            />
            <AssetTextField
              key={`${character.id}:bio`}
              draftKey={`${character.id}:bio`}
              label="简介"
              value={character.bio}
              projectId={character.projectId}
              persist={(value, baseline) => patchCharacter(character.id, { bio: value }, { bio: baseline })}
              multiline
            />
            <AssetTextField
              key={`${character.id}:appearance`}
              draftKey={`${character.id}:appearance`}
              label="外观说明"
              value={character.appearance}
              projectId={character.projectId}
              persist={(value, baseline) => patchCharacter(character.id, { appearance: value }, { appearance: baseline })}
              multiline
            />
            <AssetTextField
              key={`${character.id}:notes`}
              draftKey={`${character.id}:notes`}
              label="备注"
              value={character.notes}
              projectId={character.projectId}
              persist={(value, baseline) => patchCharacter(character.id, { notes: value }, { notes: baseline })}
              multiline
            />
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">创作细节 · 选填</summary>
              <p className="text-muted-foreground mt-2 text-xs leading-5">记录人物的行为、目标与声音，让表演前后一致。所有信息均为选填。</p>
              <div className="mt-4 space-y-4">
                <AssetTextField
                  key={`${character.id}:personality`}
                  draftKey={`${character.id}:personality`}
                  label="性格与行为"
                  value={character.personality ?? ""}
                  projectId={character.projectId}
                  persist={(value, baseline) => patchCharacter(character.id, { personality: value }, { personality: baseline })}
                  placeholder="说话习惯、待人方式、面对压力的反应"
                  multiline
                />
                <AssetTextField
                  key={`${character.id}:motivation`}
                  draftKey={`${character.id}:motivation`}
                  label="动机与目标"
                  value={character.motivation ?? ""}
                  projectId={character.projectId}
                  persist={(value, baseline) => patchCharacter(character.id, { motivation: value }, { motivation: baseline })}
                  placeholder="想要什么、害怕什么、行动的原因"
                  multiline
                />
                <AssetTextField
                  key={`${character.id}:voice`}
                  draftKey={`${character.id}:voice`}
                  label="声音与表达"
                  value={character.voice ?? ""}
                  projectId={character.projectId}
                  persist={(value, baseline) => patchCharacter(character.id, { voice: value }, { voice: baseline })}
                  placeholder="音色、语速、口音与表达习惯"
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

function goBack(
  navigate: ReturnType<typeof useNavigate>,
  back: { kind: "studio" } | { kind: "project"; projectId: string },
) {
  if (back.kind === "studio") return navigate({ to: "/characters" });
  return navigate({ to: "/p/$projectId/world", params: { projectId: back.projectId }, search: { tab: "characters" } });
}
