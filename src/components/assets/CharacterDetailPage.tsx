import {useRef, useState} from "react";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {ChevronLeft} from "lucide-react";
import {db} from "@/db/database";
import {patchCharacter, setCharacterSlot} from "@/db/assets";
import {CHARACTER_SLOTS, STUDIO_LIBRARY_ID} from "@/domain/types";
import {EditableGenerationSlot} from "@/components/slots/GenerationSlotCard";
import {AssetTextField} from "./AssetTextField";
import {Button} from "@/components/ui/button";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";

export function CharacterDetailPage(props: Parameters<typeof CharacterDetailContent>[0]) {
    const ownerId = props.back?.kind === "project" ? props.back.projectId : STUDIO_LIBRARY_ID;
    return <CharacterDetailContent key={JSON.stringify([ownerId, props.characterId])} {...props}/>;
}

function CharacterDetailContent({
                                    characterId,
                                    back,
                                }: {
    characterId: string;
    back: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
    const navigate = useNavigate();
    const ownerId = back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID;
    const result = useLiveQuery(
        async () => ({ownerId, id: characterId, value: (await db.characters.get(characterId)) ?? null}),
        [ownerId, characterId],
    );

    const loaded = result?.ownerId === ownerId && result.id === characterId ? result.value : undefined;
    const [openEditors, setOpenEditors] = useState(0);
    const lastRecord = useRef(loaded);
    if (loaded) lastRecord.current = loaded;
    const character = loaded ?? (openEditors > 0 ? lastRecord.current : loaded);

    if (character === undefined) {
        return <PageContent mode="detail"><PageState kind="loading" title="正在读取角色…"/></PageContent>;
    }
    const missing =
        character === null || character.projectId !== (back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID);
    if (missing) {
        return (
            <PageContent mode="detail">
                <PageHeader title="角色"/>
                <PageState kind="missing" title="找不到这个角色" action={<Button className="mt-3" onClick={() => void goBack(navigate, back)}>
                    {back.kind === "studio" ? "返回角色库" : "返回世界"}
                </Button>}/>
            </PageContent>
        );
    }

    return (
        <div className={back.kind === "project" ? "app-scroll h-full min-h-0 overflow-auto" : "min-h-full"}>
            {!loaded && <p role="alert" className="p-4">此设定已不可用，当前槽位草稿仍保留。可复制草稿或取消后离开。</p>}
            <PageContent mode="detail">
                <PageHeader title="角色" back={back.kind === "studio" ? (
                    <Link
                        to="/characters"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                        <ChevronLeft className="size-4" aria-hidden/> 角色设定
                    </Link>
                ) : (
                    <Link
                        to="/p/$projectId/world"
                        params={{projectId: back.projectId}}
                        search={{tab: "characters"}}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                        <ChevronLeft className="size-4" aria-hidden/> 世界
                    </Link>
                )}/>
                <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="grid grid-cols-2 items-start gap-4">
                        {CHARACTER_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={!loaded}
                                onEditorOpenChange={(open) => setOpenEditors(count => count + (open ? 1 : -1))}
                                key={slot.id}
                                projectId={character.projectId}
                                targetKey={JSON.stringify([character.projectId, "character", character.id, slot.id])}
                                label={slot.label}
                                title={`角色 · ${slot.label}`}
                                variant="asset"
                                slot={character.slots?.[slot.id]}
                                onSave={(value, baseline) => setCharacterSlot(character.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${character.id}:name`}
                            draftKey={`${character.id}:name`}
                            label="名称"
                            value={character.name}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${character.id}:bio`}
                            draftKey={`${character.id}:bio`}
                            label="简介"
                            value={character.bio}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {bio: value}, {bio: baseline})}
                            multiline
                        />
                        <AssetTextField
                            key={`${character.id}:appearance`}
                            draftKey={`${character.id}:appearance`}
                            label="外观说明"
                            value={character.appearance}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {appearance: value}, {appearance: baseline})}
                            multiline
                        />
                        <AssetTextField
                            key={`${character.id}:notes`}
                            draftKey={`${character.id}:notes`}
                            label="备注"
                            value={character.notes}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {notes: value}, {notes: baseline})}
                            multiline
                        />
                        <details className="border-t pt-4">
                            <summary className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节 · 选填</summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">记录人物的行为、目标与声音，让表演前后一致。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${character.id}:personality`}
                                    draftKey={`${character.id}:personality`}
                                    label="性格与行为"
                                    value={character.personality ?? ""}
                                    projectId={character.projectId}
                                    persist={(value, baseline) => patchCharacter(character.id, {personality: value}, {personality: baseline})}
                                    placeholder="说话习惯、待人方式、面对压力的反应"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${character.id}:motivation`}
                                    draftKey={`${character.id}:motivation`}
                                    label="动机与目标"
                                    value={character.motivation ?? ""}
                                    projectId={character.projectId}
                                    persist={(value, baseline) => patchCharacter(character.id, {motivation: value}, {motivation: baseline})}
                                    placeholder="想要什么、害怕什么、行动的原因"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${character.id}:voice`}
                                    draftKey={`${character.id}:voice`}
                                    label="声音与表达"
                                    value={character.voice ?? ""}
                                    projectId={character.projectId}
                                    persist={(value, baseline) => patchCharacter(character.id, {voice: value}, {voice: baseline})}
                                    placeholder="音色、语速、口音与表达习惯"
                                    multiline
                                />
                            </div>
                        </details>
                    </div>
                </div>
            </PageContent>
        </div>
    );
}

function goBack(
    navigate: ReturnType<typeof useNavigate>,
    back: { kind: "studio" } | { kind: "project"; projectId: string },
) {
    if (back.kind === "studio") return navigate({to: "/characters"});
    return navigate({to: "/p/$projectId/world", params: {projectId: back.projectId}, search: {tab: "characters"}});
}
