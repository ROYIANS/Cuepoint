import {matchesAssetSearch, type WorldTab} from "@/lib/assetLibrary";
import {Input} from "@/components/ui/input";
import {copySelection} from "@/lib/copySelection";
import {Link, useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {Library, Plus, Trash2} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";
import {db} from "@/db/database";
import {
    addCharacter,
    addProp,
    addScene,
    addStyle,
    deleteCharacter,
    deleteProp,
    deleteScene,
    deleteStyle
} from "@/db/assets";
import {copyStudioCharacter, copyStudioProp, copyStudioScene, copyStudioStyle} from "@/db/assetReuse";
import {firstResultId} from "@/domain/slot";
import {
    type Character,
    CHARACTER_SLOTS,
    type Id,
    type Prop,
    PROP_SLOTS,
    type Scene,
    SCENE_SLOTS,
    STUDIO_LIBRARY_ID,
    STYLE_SLOTS,
    type VisualStyle,
} from "@/domain/types";
import {MediaPreview} from "@/components/media/MediaThumb";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {WorldSettingPanel} from "@/components/assets/WorldSettingPanel";
import {PageContent, PageHeader, PageState, PageToolbar} from "@/components/layout/PageLayout";

type AssetTab = Exclude<WorldTab, "setting">;
type WorldAsset = Character | Scene | Prop | VisualStyle;

const TAB_COPY: Record<AssetTab, { singular: string; create: string }> = {
    characters: {singular: "角色", create: "新建角色"},
    scenes: {singular: "场景", create: "新建场景"},
    props: {singular: "道具", create: "新建道具"},
    styles: {singular: "风格", create: "新建风格"},
};

function sourceAssetId(asset: WorldAsset): string | undefined {
    const value = asset.extra?.sourceAssetId;
    return typeof value === "string" ? value : undefined;
}

function coverOf(asset: WorldAsset, tab: AssetTab): Id | undefined {
    if (tab === "characters") {
        const character = asset as Character;
        return firstResultId(CHARACTER_SLOTS.map((slot) => character.slots?.[slot.id]));
    }
    if (tab === "scenes") {
        const scene = asset as Scene;
        return firstResultId(SCENE_SLOTS.map((slot) => scene.slots?.[slot.id]));
    }
    if (tab === "props") {
        const prop = asset as Prop;
        return firstResultId(PROP_SLOTS.map((slot) => prop.slots?.[slot.id]));
    }
    const style = asset as VisualStyle;
    return firstResultId(STYLE_SLOTS.map((slot) => style.slots?.[slot.id]));
}

function assetDetail(asset: WorldAsset, tab: AssetTab): string {
    if (tab === "characters") return (asset as Character).appearance || "未填写外观";
    if (tab === "scenes") {
        const scene = asset as Scene;
        return [scene.location, scene.timeOfDay].filter(Boolean).join(" · ") || "未填写地点";
    }
    if (tab === "props") return (asset as Prop).kind || "未填写类型";
    return asset.notes || "未填写风格说明";
}

export function AssetLibraryPage({projectId, tab, onTabChange}: {
    projectId: string;
    tab: WorldTab;
    onTabChange: (tab: WorldTab) => void;
}) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const charactersResult =
        useLiveQuery(
            () => db.characters.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
            [projectId],
        );
    const characters = charactersResult ?? [];
    const scenesResult =
        useLiveQuery(
            () => db.scenes.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
            [projectId],
        );
    const scenes = scenesResult ?? [];
    const propsResult =
        useLiveQuery(
            () => db.props.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
            [projectId],
        );
    const props = propsResult ?? [];
    const stylesResult =
        useLiveQuery(
            () => db.styles.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
            [projectId],
        );
    const styles = stylesResult ?? [];
    const [pendingDelete, setPendingDelete] = useState<
        { tab: AssetTab; id: string; name: string } | undefined
    >();

    const assets: Record<AssetTab, WorldAsset[]> = {characters, scenes, props, styles};
    const loading = {characters: charactersResult === undefined, scenes: scenesResult === undefined, props: propsResult === undefined, styles: stylesResult === undefined};
    const activeAssets = tab === "setting" ? [] : assets[tab].filter((asset) => matchesAssetSearch(asset, query));

    async function createLocal(activeTab: AssetTab) {
        if (activeTab === "characters") {
            const asset = await addCharacter(projectId);
            await navigate({
                to: "/p/$projectId/assets/characters/$characterId",
                params: {projectId, characterId: asset.id},
            });
        } else if (activeTab === "scenes") {
            const asset = await addScene(projectId);
            await navigate({
                to: "/p/$projectId/assets/scenes/$sceneId",
                params: {projectId, sceneId: asset.id},
            });
        } else if (activeTab === "props") {
            const asset = await addProp(projectId);
            await navigate({
                to: "/p/$projectId/assets/props/$propId",
                params: {projectId, propId: asset.id},
            });
        } else {
            const asset = await addStyle(projectId);
            await navigate({
                to: "/p/$projectId/assets/styles/$styleId",
                params: {projectId, styleId: asset.id},
            });
        }
    }

    return (
        <div className="app-scroll h-full min-h-0 min-w-0 overflow-auto">
            <PageContent mode="collection">
                <PageHeader title="世界" description="管理项目共用的世界设定、角色、场景、道具与风格。"
                            actions={tab !== "setting" ? (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => setPickerOpen(true)}>
                                <Library/> 从工作室添加
                            </Button>
                            <Button variant="brand" onClick={() => void createLocal(tab)}>
                                <Plus/> {TAB_COPY[tab].create}
                            </Button>
                        </div>
                    ) : undefined}/>

                <PageToolbar>
                <Tabs
                    value={tab}
                    onValueChange={(value) => {
                        setQuery("");
                        onTabChange(value as WorldTab);
                    }}
                >
                    <TabsList className="h-auto flex-wrap">
                        <TabsTrigger value="setting">设定</TabsTrigger>
                        <TabsTrigger value="characters">角色 {characters.length}</TabsTrigger>
                        <TabsTrigger value="scenes">场景 {scenes.length}</TabsTrigger>
                        <TabsTrigger value="props">道具 {props.length}</TabsTrigger>
                        <TabsTrigger value="styles">风格 {styles.length}</TabsTrigger>
                    </TabsList>
                </Tabs>

                {tab !== "setting" ? <Input className="max-w-sm md:ml-auto" aria-label={`搜索项目${TAB_COPY[tab].singular}`}
                                            placeholder={`搜索${TAB_COPY[tab].singular}名称与设定…`} value={query}
                                            onChange={(event) => setQuery(event.target.value)}/> : null}
                </PageToolbar>
                {tab === "setting" ? (
                    <WorldSettingPanel projectId={projectId}/>
                ) : loading[tab] ? <PageState kind="loading" title={`正在读取${TAB_COPY[tab].singular}…`}/> : activeAssets.length === 0 ? (
                    query.trim() ?
                        <PageState title={`没有匹配的${TAB_COPY[tab].singular}`} description="试试其他关键词。"/> :
                        <EmptyWorldTab singular={TAB_COPY[tab].singular}/>
                ) : (
                    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                        {activeAssets.map((asset) => (
                            <AssetCard
                                key={asset.id}
                                projectId={projectId}
                                tab={tab}
                                asset={asset}
                                onDelete={() => setPendingDelete({tab, id: asset.id, name: asset.name})}
                            />
                        ))}
                    </ul>
                )}
            </PageContent>

            {tab !== "setting" ? (
                <StudioAssetPicker
                    key={tab}
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    projectId={projectId}
                    tab={tab}
                    copiedAssets={assets[tab]}
                />
            ) : null}

            <AlertDialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => !open && setPendingDelete(undefined)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            删除{pendingDelete ? TAB_COPY[pendingDelete.tab].singular : "资产"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            确定删除「{pendingDelete?.name}」？已有引用会被清除。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => {
                                if (!pendingDelete) return;
                                if (pendingDelete.tab === "characters") void deleteCharacter(pendingDelete.id);
                                else if (pendingDelete.tab === "scenes") void deleteScene(pendingDelete.id);
                                else if (pendingDelete.tab === "props") void deleteProp(pendingDelete.id);
                                else void deleteStyle(pendingDelete.id);
                            }}
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function AssetCard({
                       projectId,
                       tab,
                       asset,
                       onDelete,
                   }: {
    projectId: string;
    tab: AssetTab;
    asset: WorldAsset;
    onDelete: () => void;
}) {
    const card = (
        <>
            <MediaPreview
                mediaId={coverOf(asset, tab)}
                className="aspect-[4/3] w-full"
                empty={TAB_COPY[tab].singular}
            />
            <div className="px-3 py-3">
                <p className="truncate text-sm leading-[22px] font-semibold" title={asset.name}>{asset.name}</p>
                <p className="text-muted-foreground truncate text-xs">{assetDetail(asset, tab)}</p>
            </div>
        </>
    );
    return (
        <li className="group relative">
            {tab === "characters" ? (
                <Link
                    to="/p/$projectId/assets/characters/$characterId"
                    params={{projectId, characterId: asset.id}}
                    className="bg-card focus-visible:ring-ring/50 block overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-[3px]"
                >
                    {card}
                </Link>
            ) : tab === "scenes" ? (
                <Link
                    to="/p/$projectId/assets/scenes/$sceneId"
                    params={{projectId, sceneId: asset.id}}
                    className="bg-card focus-visible:ring-ring/50 block overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-[3px]"
                >
                    {card}
                </Link>
            ) : tab === "props" ? (
                <Link
                    to="/p/$projectId/assets/props/$propId"
                    params={{projectId, propId: asset.id}}
                    className="bg-card focus-visible:ring-ring/50 block overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-[3px]"
                >
                    {card}
                </Link>
            ) : (
                <Link
                    to="/p/$projectId/assets/styles/$styleId"
                    params={{projectId, styleId: asset.id}}
                    className="bg-card focus-visible:ring-ring/50 block overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-[3px]"
                >
                    {card}
                </Link>
            )}
            <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute top-2 right-2 flex"
                onClick={onDelete}
                aria-label={`删除${TAB_COPY[tab].singular} ${asset.name}`}
            >
                <Trash2/>
            </Button>
        </li>
    );
}

function StudioAssetPicker({
                               open,
                               onOpenChange,
                               projectId,
                               tab,
                               copiedAssets,
                           }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    tab: AssetTab;
    copiedAssets: WorldAsset[];
}) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [copying, setCopying] = useState(false);
    const [query, setQuery] = useState("");
    const studioAssetsResult =
        useLiveQuery(async () => {
            const table =
                tab === "characters"
                    ? db.characters
                    : tab === "scenes"
                        ? db.scenes
                        : tab === "props"
                            ? db.props
                            : db.styles;
            return table.where("projectId").equals(STUDIO_LIBRARY_ID).reverse().sortBy("updatedAt");
        }, [tab]);
    const studioAssets = studioAssetsResult ?? [];
    const copiedSourceIds = new Set(
        copiedAssets.map(sourceAssetId).filter((id): id is string => Boolean(id)),
    );
    const available = studioAssets.filter((asset) => !copiedSourceIds.has(asset.id) && matchesAssetSearch(asset, query));

    function closePicker() {
        setSelected(new Set());
        onOpenChange(false);
    }

    async function copySelected() {
        setCopying(true);
        try {
            const copied = await copySelection(selected, copiedSourceIds, async (sourceId) => {
                if (tab === "characters") await copyStudioCharacter(projectId, sourceId);
                else if (tab === "scenes") await copyStudioScene(projectId, sourceId);
                else if (tab === "props") await copyStudioProp(projectId, sourceId);
                else await copyStudioStyle(projectId, sourceId);
            }, (sourceId) => setSelected((current) => new Set([...current].filter((id) => id !== sourceId))));
            toast.success(`已添加 ${copied} 个${TAB_COPY[tab].singular}`);
            closePicker();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "添加失败");
        } finally {
            setCopying(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (copying) return;
                if (!nextOpen) setSelected(new Set());
                onOpenChange(nextOpen);
            }}
        >
            <DialogContent className="flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>从工作室添加{TAB_COPY[tab].singular}</DialogTitle>
                    <DialogDescription>添加后成为项目快照，可以独立修改。</DialogDescription>
                </DialogHeader>
                <Input aria-label="搜索工作室资产" placeholder="搜索名称与设定…" value={query}
                       disabled={copying} onChange={(event) => setQuery(event.target.value)}/>
                <div className="min-h-0 space-y-2 overflow-auto p-1">
                    {studioAssetsResult === undefined ? <PageState compact kind="loading" title="正在读取工作室设定…"/> : available.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            {query.trim() ? "没有匹配的" : "没有可添加的"}工作室{TAB_COPY[tab].singular}
                        </p>
                    ) : (
                        available.map((asset) => (
                            <label
                                key={asset.id}
                                className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border p-3"
                            >
                                <Checkbox
                                    disabled={copying}
                                    checked={selected.has(asset.id)}
                                    onCheckedChange={(checked) =>
                                        setSelected((current) => {
                                            const next = new Set(current);
                                            if (checked) next.add(asset.id);
                                            else next.delete(asset.id);
                                            return next;
                                        })
                                    }
                                />
                                <MediaPreview
                                    mediaId={coverOf(asset, tab)}
                                    className="size-12 shrink-0 rounded-lg"
                                    empty={TAB_COPY[tab].singular}
                                />
                                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{asset.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {assetDetail(asset, tab)}
                  </span>
                </span>
                            </label>
                        ))
                    )}
                </div>
                <DialogFooter className="shrink-0">
                    <Button variant="outline" disabled={copying} onClick={closePicker}>
                        取消
                    </Button>
                    <Button
                        variant="brand"
                        disabled={selected.size === 0 || copying}
                        onClick={() => void copySelected()}
                    >
                        {copying ? "添加中…" : `添加 ${selected.size || ""}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EmptyWorldTab({singular}: { singular: string }) {
    return <PageState title={`还没有${singular}`} description="可以新建，或从工作室添加一份可独立修改的快照。"/>;
}
