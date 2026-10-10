import {useRef, useState} from "react";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {ChevronLeft} from "lucide-react";
import {db} from "@/db/database";
import {patchStyle, setStyleSlot} from "@/db/assets";
import {STUDIO_LIBRARY_ID, STYLE_SLOTS} from "@/domain/types";
import {EditableGenerationSlot} from "@/components/slots/GenerationSlotCard";
import {AssetTextField} from "./AssetTextField";
import {Button} from "@/components/ui/button";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";

export function StyleDetailPage(props: Parameters<typeof StyleDetailContent>[0]) {
    const ownerId = props.back?.kind === "project" ? props.back.projectId : STUDIO_LIBRARY_ID;
    return <StyleDetailContent key={JSON.stringify([ownerId, props.styleId])} {...props}/>;
}

function StyleDetailContent({
                                styleId,
                                back = {kind: "studio"},
                            }: {
    styleId: string;
    back?: { kind: "studio" } | { kind: "project"; projectId: string };
}) {
    const navigate = useNavigate();
    const ownerId = back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID;
    const result = useLiveQuery(async () => ({
        ownerId,
        id: styleId,
        value: (await db.styles.get(styleId)) ?? null
    }), [ownerId, styleId]);

    const loaded = result?.ownerId === ownerId && result.id === styleId ? result.value : undefined;
    const [openEditors, setOpenEditors] = useState(0);
    const lastRecord = useRef(loaded);
    if (loaded) lastRecord.current = loaded;
    const style = loaded ?? (openEditors > 0 ? lastRecord.current : loaded);

    if (style === undefined) {
        return <PageContent mode="detail"><PageState kind="loading" title="正在读取风格…"/></PageContent>;
    }
    const missing =
        style === null || style.projectId !== (back.kind === "project" ? back.projectId : STUDIO_LIBRARY_ID);
    if (missing) {
        return (
            <PageContent mode="detail">
                <PageHeader title="风格"/>
                <PageState kind="missing" title="找不到这个风格" action={<Button
                    className="mt-3"
                    onClick={() =>
                        void (back.kind === "studio"
                            ? navigate({to: "/styles"})
                            : navigate({
                                to: "/p/$projectId/world",
                                params: {projectId: back.projectId},
                                search: {tab: "styles"}
                            }))
                    }
                >
                    {back.kind === "studio" ? "返回风格库" : "返回世界"}
                </Button>}/>
            </PageContent>
        );
    }

    return (
        <div className={back.kind === "project" ? "app-scroll h-full min-h-0 overflow-auto" : "min-h-full"}>
            {!loaded && <p role="alert" className="p-4">此设定已不可用，当前槽位草稿仍保留。可复制草稿或取消后离开。</p>}
            <PageContent mode="detail">
                <PageHeader title="风格" back={back.kind === "studio" ? (
                    <Link
                        to="/styles"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                        <ChevronLeft className="size-4" aria-hidden/> 视觉风格
                    </Link>
                ) : (
                    <Link
                        to="/p/$projectId/world"
                        params={{projectId: back.projectId}}
                        search={{tab: "styles"}}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                    >
                        <ChevronLeft className="size-4" aria-hidden/> 世界
                    </Link>
                )}/>
                <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="grid grid-cols-2 items-start gap-4">
                        {STYLE_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={!loaded}
                                onEditorOpenChange={(open) => setOpenEditors(count => count + (open ? 1 : -1))}
                                key={slot.id}
                                projectId={style.projectId}
                                targetKey={JSON.stringify([style.projectId, "style", style.id, slot.id])}
                                label={slot.label}
                                title={`风格 · ${slot.label}`}
                                variant="asset"
                                slot={style.slots?.[slot.id]}
                                onSave={(value, baseline) => setStyleSlot(style.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${style.id}:name`}
                            draftKey={`${style.id}:name`}
                            label="名称"
                            value={style.name}
                            projectId={style.projectId}
                            persist={(value, baseline) => patchStyle(style.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${style.id}:notes`}
                            draftKey={`${style.id}:notes`}
                            label="备注"
                            value={style.notes}
                            projectId={style.projectId}
                            persist={(value, baseline) => patchStyle(style.id, {notes: value}, {notes: baseline})}
                            multiline
                            placeholder="画风、光色、镜头气质"
                        />
                        <details className="border-t pt-4">
                            <summary className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节 · 选填</summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">把色彩、光影与构图方向写清楚，作为整部作品的视觉依据。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${style.id}:palette`}
                                    draftKey={`${style.id}:palette`}
                                    label="色彩方案"
                                    value={style.palette ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {palette: value}, {palette: baseline})}
                                    placeholder="主色、辅助色、饱和度与色彩关系"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:lighting`}
                                    draftKey={`${style.id}:lighting`}
                                    label="光影风格"
                                    value={style.lighting ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {lighting: value}, {lighting: baseline})}
                                    placeholder="柔硬、反差、色温与阴影"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:lens`}
                                    draftKey={`${style.id}:lens`}
                                    label="镜头气质"
                                    value={style.lens ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {lens: value}, {lens: baseline})}
                                    placeholder="焦段倾向、景深、畸变与颗粒"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:composition`}
                                    draftKey={`${style.id}:composition`}
                                    label="构图原则"
                                    value={style.composition ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {composition: value}, {composition: baseline})}
                                    placeholder="画面重心、留白、对称与层次"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:negativePrompt`}
                                    draftKey={`${style.id}:negativePrompt`}
                                    label="避免出现"
                                    value={style.negativePrompt ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {negativePrompt: value}, {negativePrompt: baseline})}
                                    placeholder="不希望出现的颜色、质感、构图或元素"
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
