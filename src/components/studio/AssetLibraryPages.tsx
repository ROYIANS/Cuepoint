import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { CoverCard, CreateTile, LibraryGrid } from "@/components/studio/CoverCard";
import { LibraryHeader } from "@/components/studio/LibraryHeader";
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
import { db } from "@/db/database";
import {
  addCharacter,
  addProp,
  addScene,
  addStyle,
  deleteCharacter,
  deleteProp,
  deleteScene,
  deleteStyle,
} from "@/db/repo";
import { firstResultId } from "@/domain/slot";
import {
  CHARACTER_SLOTS,
  PROP_SLOTS,
  SCENE_SLOTS,
  STUDIO_LIBRARY_ID,
  STYLE_SLOTS,
  isStudioLibrary,
  type Character,
  type Prop,
  type Scene,
  type VisualStyle,
} from "@/domain/types";
import { formatUpdatedAt } from "@/lib/format";
import { filterAndSortLibrary, type LibrarySort } from "@/lib/library";

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
    hint: "衣服、物件、关键道具。创建后留在这里，以后给角色和分镜引用。",
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
  return <StudioLibrary kind="character" />;
}

export function SceneLibraryPage() {
  return <StudioLibrary kind="scene" />;
}

export function PropLibraryPage() {
  return <StudioLibrary kind="prop" />;
}

export function StyleLibraryPage() {
  return <StudioLibrary kind="style" />;
}

function StudioLibrary({ kind }: { kind: LibraryKind }) {
  const navigate = useNavigate();
  const copy = COPY[kind];
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const characters = useLiveQuery(() => db.characters.toArray(), []) ?? [];
  const scenes = useLiveQuery(() => db.scenes.toArray(), []) ?? [];
  const props = useLiveQuery(() => db.props.toArray(), []) ?? [];
  const styles = useLiveQuery(() => db.styles.toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string }>();

  const projectName = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const raw: { id: string; name: string; projectId: string; createdAt: string; updatedAt: string }[] =
    kind === "character"
      ? characters
      : kind === "scene"
        ? scenes
        : kind === "prop"
          ? props
          : styles;
  const items = filterAndSortLibrary(raw, query, sort);

  function ownerLabel(ownerId: string) {
    if (isStudioLibrary(ownerId)) return "工作室";
    return projectName.get(ownerId) ?? "未知项目";
  }

  async function handleCreate() {
    if (kind === "character") {
      const character = await addCharacter(STUDIO_LIBRARY_ID);
      await navigate({ to: "/characters/$characterId", params: { characterId: character.id } });
      return;
    }
    if (kind === "scene") {
      const scene = await addScene(STUDIO_LIBRARY_ID);
      await navigate({ to: "/scenes/$sceneId", params: { sceneId: scene.id } });
      return;
    }
    if (kind === "prop") {
      const prop = await addProp(STUDIO_LIBRARY_ID);
      await navigate({ to: "/props/$propId", params: { propId: prop.id } });
      return;
    }
    const style = await addStyle(STUDIO_LIBRARY_ID);
    await navigate({ to: "/styles/$styleId", params: { styleId: style.id } });
  }

  function openItem(id: string) {
    if (kind === "character") {
      void navigate({ to: "/characters/$characterId", params: { characterId: id } });
      return;
    }
    if (kind === "scene") {
      void navigate({ to: "/scenes/$sceneId", params: { sceneId: id } });
      return;
    }
    if (kind === "prop") {
      void navigate({ to: "/props/$propId", params: { propId: id } });
      return;
    }
    void navigate({ to: "/styles/$styleId", params: { styleId: id } });
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
    <div className="px-10 py-8">
      <LibraryHeader title={copy.title} query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
      <p className="text-muted-foreground mt-3 max-w-xl text-[13px] leading-6">{copy.hint}</p>
      <div className="mt-8">
        <LibraryGrid>
          <CreateTile label={copy.create} hint="留在工作室" onClick={() => void handleCreate()} />
          {items.map((item) => (
            <CoverCard
              key={item.id}
              title={item.name}
              subtitle={`${ownerLabel(item.projectId)} · ${formatUpdatedAt(item.updatedAt)}`}
              mediaId={coverOf(item.id)}
              onOpen={() => openItem(item.id)}
              actions={[
                {
                  label: "删除",
                  tone: "danger",
                  onSelect: () => setPendingDelete({ id: item.id, name: item.name }),
                },
              ]}
            />
          ))}
        </LibraryGrid>
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.empty}</AlertDialogTitle>
            <AlertDialogDescription>确定删除「{pendingDelete?.name}」？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDelete) return;
                if (kind === "character") void deleteCharacter(pendingDelete.id);
                else if (kind === "scene") void deleteScene(pendingDelete.id);
                else if (kind === "prop") void deleteProp(pendingDelete.id);
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
