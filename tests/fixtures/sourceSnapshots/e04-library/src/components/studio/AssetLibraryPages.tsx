import {useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {CoverCard, CreateTile, LibraryGrid} from "@/components/studio/CoverCard";
import {LibraryHeader} from "@/components/studio/LibraryHeader";
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
import {db} from "@/db/database";
import {addCharacter, addProp, addScene, addStyle, deleteCharacter, deleteProp, deleteScene, deleteStyle} from "@/db/assets";
import {firstResultId} from "@/domain/slot";
import {
    type Character,
    CHARACTER_SLOTS,
    type Prop,
    PROP_SLOTS,
    type Scene,
    SCENE_SLOTS,
    STUDIO_LIBRARY_ID,
    STYLE_SLOTS,
    type VisualStyle,
} from "@/domain/types";
import {matchesAssetSearch} from "@/lib/assetLibrary";
import {formatUpdatedAt} from "@/lib/format";
import {filterAndSortLibrary, type LibrarySort} from "@/lib/library";

function characterCover(character: Character) {
    return firstResultId(CHARACTER_SLOTS.map((slot) => character.slots?.[slot.id]));
}

function sceneCover(scene: Scene) {
    return firstResultId(SCENE_SLOTS.map((slot) => scene.slots?.[slot.id]));
}

function propCover(prop: Prop) {
    return firstResultId(PROP_SLOTS.map((slot) => prop.slots?.[slot.id]));
}

function styleCover(style: VisualStyle) {
    return firstResultId(STYLE_SLOTS.map((slot) => style.slots?.[slot.id]));
}

type LibraryKind = "character" | "scene" | "prop" | "style";

const COPY: Record<
    LibraryKind,
    { title: string; hint: string; create: string; empty: string }
> = {
    character: {
        title: "角色设定",
        hint: "工作室里的人。创建后留在这里编辑，项目再引用，不跳进某部戏。",
        create: "创建角色",
        empty: "删掉这个角色？",
    },
    scene: {
        title: "常用场景",
        hint: "工作室里的地。创建后留在这里编辑，项目再引用。",
        create: "创建场景",
        empty: "删掉这个场景？",
    },
    prop: {
        title: "道具",
        hint: "衣服、物件、关键道具。添加到项目后可关联分镜，项目中的修改不影响这里。",
        create: "创建道具",
        empty: "删掉这个道具？",
    },
    style: {
        title: "视觉风格",
        hint: "画风、光色、镜头气质。创建后留在这里，避免每部戏重新发明。",
        create: "创建风格",
        empty: "删掉这个风格？",
    },
};

export function CharacterLibraryPage() {
    return <StudioLibrary key="character" kind="character"/>;
}

export function SceneLibraryPage() {
    return <StudioLibrary key="scene" kind="scene"/>;
}

export function PropLibraryPage() {
    return <StudioLibrary key="prop" kind="prop"/>;
}

export function StyleLibraryPage() {
    return <StudioLibrary key="style" kind="style"/>;
}

function StudioLibrary({kind}: { kind: LibraryKind }) {
    const navigate = useNavigate();
    const activeRef = useRef(true);
    useEffect(() => {
        activeRef.current = true;
        return () => {activeRef.current = false;};
    }, []);
    const creatingRef = useRef(false);
    const deletingRef = useRef(false);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const copy = COPY[kind];
    const characters = useLiveQuery(() => db.characters.where("projectId").equals(STUDIO_LIBRARY_ID).toArray(), []) ?? [];
    const scenes = useLiveQuery(() => db.scenes.where("projectId").equals(STUDIO_LIBRARY_ID).toArray(), []) ?? [];
    const props = useLiveQuery(() => db.props.where("projectId").equals(STUDIO_LIBRARY_ID).toArray(), []) ?? [];
    const styles = useLiveQuery(() => db.styles.where("projectId").equals(STUDIO_LIBRARY_ID).toArray(), []) ?? [];
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<LibrarySort>("updated");
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string }>();

    const raw: { id: string; name: string; projectId: string; createdAt: string; updatedAt: string }[] =
        kind === "character"
            ? characters
            : kind === "scene"
                ? scenes
                : kind === "prop"
                    ? props
                    : styles;
    const items = filterAndSortLibrary(raw.filter((item) => matchesAssetSearch(item, query)), "", sort);

    async function handleCreate() {
        if (creatingRef.current || deletingRef.current) return;
        creatingRef.current = true;
        setCreating(true);
        try {
            if (kind === "character") {
                const character = await addCharacter(STUDIO_LIBRARY_ID);
                if (!activeRef.current) return;
                await navigate({to: "/characters/$characterId", params: {characterId: character.id}});
                return;
            }
            if (kind === "scene") {
                const scene = await addScene(STUDIO_LIBRARY_ID);
                if (!activeRef.current) return;
                await navigate({to: "/scenes/$sceneId", params: {sceneId: scene.id}});
                return;
            }
            if (kind === "prop") {
                const prop = await addProp(STUDIO_LIBRARY_ID);
                if (!activeRef.current) return;
                await navigate({to: "/props/$propId", params: {propId: prop.id}});
                return;
            }
            const style = await addStyle(STUDIO_LIBRARY_ID);
            if (!activeRef.current) return;
            await navigate({to: "/styles/$styleId", params: {styleId: style.id}});
        } catch (error) {
            if (activeRef.current) toast.error(error instanceof Error && error.message ? error.message : "创建失败，请重试");
        } finally {
            creatingRef.current = false;
            if (activeRef.current) setCreating(false);
        }
    }

    async function handleDelete() {
        if (!pendingDelete || deletingRef.current || creatingRef.current) return;
        const target = pendingDelete;
        deletingRef.current = true;
        setDeleting(true);
        setDeleteError("");
        try {
            if (kind === "character") await deleteCharacter(target.id);
            else if (kind === "scene") await deleteScene(target.id);
            else if (kind === "prop") await deleteProp(target.id);
            else await deleteStyle(target.id);
            if (activeRef.current) setPendingDelete((current) => current === target ? undefined : current);
        } catch (error) {
            if (activeRef.current) setDeleteError(error instanceof Error && error.message ? error.message : "删除失败，请重试");
        } finally {
            deletingRef.current = false;
            if (activeRef.current) setDeleting(false);
        }
    }

    function openItem(id: string) {
        if (kind === "character") {
            void navigate({to: "/characters/$characterId", params: {characterId: id}});
            return;
        }
        if (kind === "scene") {
            void navigate({to: "/scenes/$sceneId", params: {sceneId: id}});
            return;
        }
        if (kind === "prop") {
            void navigate({to: "/props/$propId", params: {propId: id}});
            return;
        }
        void navigate({to: "/styles/$styleId", params: {styleId: id}});
    }

    function coverOf(id: string) {
        if (kind === "character") {
            const item = characters.find((character) => character.id === id);
            return item ? characterCover(item) : undefined;
        }
        if (kind === "scene") {
            const item = scenes.find((scene) => scene.id === id);
            return item ? sceneCover(item) : undefined;
        }
        if (kind === "prop") {
            const item = props.find((prop) => prop.id === id);
            return item ? propCover(item) : undefined;
        }
        const item = styles.find((style) => style.id === id);
        return item ? styleCover(item) : undefined;
    }

    return (
        <div className="px-4 py-8 sm:px-10">
            <LibraryHeader title={copy.title} query={query} onQuery={setQuery} sort={sort} onSort={setSort}/>
            <p className="text-muted-foreground mt-3 max-w-xl text-[13px] leading-6">{copy.hint}</p>
            <div className="mt-8">
                <LibraryGrid>
                    <CreateTile label={creating ? "创建中…" : copy.create} hint="留在工作室" onClick={() => void handleCreate()}/>
                    {items.map((item) => (
                        <CoverCard
                            key={item.id}
                            title={item.name}
                            subtitle={`工作室 · ${formatUpdatedAt(item.updatedAt)}`}
                            mediaId={coverOf(item.id)}
                            onOpen={() => openItem(item.id)}
                            actions={[
                                {
                                    label: "删除",
                                    tone: "danger",
                                    onSelect: () => {
                                        if (deletingRef.current || creatingRef.current) return;
                                        setDeleteError("");
                                        setPendingDelete({id: item.id, name: item.name});
                                    },
                                },
                            ]}
                        />
                    ))}
                </LibraryGrid>
                {query.trim() && items.length === 0 ?
                    <p className="text-muted-foreground mt-6 text-sm">没有匹配的资产，试试其他关键词。</p> : null}
            </div>

            <AlertDialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => {
                    if (!open && !deletingRef.current) setPendingDelete(undefined);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{copy.empty}</AlertDialogTitle>
                        <AlertDialogDescription>确定删除「{pendingDelete?.name}」？</AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && <p role="alert" className="text-destructive text-sm">{deleteError}</p>}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleDelete();
                            }}
                        >
                            {deleting ? "删除中…" : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
