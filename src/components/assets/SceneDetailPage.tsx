import {useRef, useState} from "react";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {ChevronLeft} from "lucide-react";
import {db} from "@/db/database";
import {patchScene, setSceneSlot} from "@/db/assets";
import {SCENE_SLOTS, STUDIO_LIBRARY_ID} from "@/domain/types";
import {EditableGenerationSlot} from "@/components/slots/GenerationSlotCard";
import {AssetTextField} from "./AssetTextField";
import {Button} from "@/components/ui/button";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";

export function SceneDetailPage(props: Parameters<typeof SceneDetailContent>[0]) {
    const ownerId = props.back?.kind === "project" ? props.back.projectId : STUDIO_LIBRARY_ID;
    return <SceneDetailContent key={JSON.stringify([ownerId, props.sceneId])} {...props}/>;
}

function SceneDetailContent({
                                sceneId,
                                back,
                            }: {
    sceneId: string;
    back: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
    const navigate = useNavigate();
    const ownerId = back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID;
    const result = useLiveQuery(async () => ({
        ownerId,
        id: sceneId,
        value: (await db.scenes.get(sceneId)) ?? null
    }), [ownerId, sceneId]);

    const loaded = result?.ownerId === ownerId && result.id === sceneId ? result.value : undefined;
    const [openEditors, setOpenEditors] = useState(0);
    const lastRecord = useRef(loaded);
    if (loaded) lastRecord.current = loaded;
    const scene = loaded ?? (openEditors > 0 ? lastRecord.current : loaded);

    if (scene === undefined) {
        return <PageContent mode="detail"><PageState kind="loading" title="正在读取场景…"/></PageContent>;
    }
    const missing =
        scene === null || scene.projectId !== (back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID);
    if (missing) {
        return (
            <PageContent mode="detail">
                <PageHeader title="场景"/>
                <PageState kind="missing" title="找不到这个场景" action={<Button
                    className="mt-3"
                    onClick={() =>
                        void (back.kind === "studio"
                            ? navigate({to: "/scenes"})
                            : navigate({
                                to: "/p/$projectId/world",
                                params: {projectId: back.projectId},
                                search: {tab: "scenes"}
                            }))
                    }
                >
                    {back.kind === "studio" ? "返回场景库" : "返回世界"}
                </Button>}/>
            </PageContent>
        );
    }

    return (
        <div className={back.kind === "project" ? "app-scroll h-full min-h-0 overflow-auto" : "min-h-full"}>
            {!loaded && <p role="alert" className="p-4">此设定已不可用，当前槽位草稿仍保留。可复制草稿或取消后离开。</p>}
            <PageContent mode="detail">
                <PageHeader title="场景" back={back.kind === "studio" ? (
                    <Link
                        to="/scenes"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                        <ChevronLeft className="size-4" aria-hidden/> 常用场景
                    </Link>
                ) : (
                    <Link
                        to="/p/$projectId/world"
                        params={{projectId: back.projectId}}
                        search={{tab: "scenes"}}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                        <ChevronLeft className="size-4" aria-hidden/> 世界
                    </Link>
                )}/>
                <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="grid grid-cols-2 items-start gap-4">
                        {SCENE_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={!loaded}
                                onEditorOpenChange={(open) => setOpenEditors(count => count + (open ? 1 : -1))}
                                key={slot.id}
                                projectId={scene.projectId}
                                targetKey={JSON.stringify([scene.projectId, "scene", scene.id, slot.id])}
                                label={slot.label}
                                title={`场景 · ${slot.label}`}
                                variant="asset"
                                slot={scene.slots?.[slot.id]}
                                onSave={(value, baseline) => setSceneSlot(scene.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${scene.id}:name`}
                            draftKey={`${scene.id}:name`}
                            label="名称"
                            value={scene.name}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${scene.id}:location`}
                            draftKey={`${scene.id}:location`}
                            label="地点"
                            value={scene.location}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {location: value}, {location: baseline})}
                        />
                        <AssetTextField
                            key={`${scene.id}:timeOfDay`}
                            draftKey={`${scene.id}:timeOfDay`}
                            label="时段"
                            value={scene.timeOfDay}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {timeOfDay: value}, {timeOfDay: baseline})}
                            placeholder="日 / 夜 / 黄昏"
                        />
                        <AssetTextField
                            key={`${scene.id}:atmosphere`}
                            draftKey={`${scene.id}:atmosphere`}
                            label="氛围"
                            value={scene.atmosphere}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {atmosphere: value}, {atmosphere: baseline})}
                        />
                        <AssetTextField
                            key={`${scene.id}:notes`}
                            draftKey={`${scene.id}:notes`}
                            label="备注"
                            value={scene.notes}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {notes: value}, {notes: baseline})}
                            multiline
                        />
                        <details className="border-t pt-4">
                            <summary className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节 · 选填</summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">记录空间与光线，方便安排机位和延续场景氛围。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${scene.id}:geography`}
                                    draftKey={`${scene.id}:geography`}
                                    label="空间布局"
                                    value={scene.geography ?? ""}
                                    projectId={scene.projectId}
                                    persist={(value, baseline) => patchScene(scene.id, {geography: value}, {geography: baseline})}
                                    placeholder="出入口、动线、主要物件之间的位置关系"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${scene.id}:lighting`}
                                    draftKey={`${scene.id}:lighting`}
                                    label="光线设计"
                                    value={scene.lighting ?? ""}
                                    projectId={scene.projectId}
                                    persist={(value, baseline) => patchScene(scene.id, {lighting: value}, {lighting: baseline})}
                                    placeholder="主光来源、方向、冷暖与明暗层次"
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
