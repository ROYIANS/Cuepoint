import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CoverCard, CreateTile, LibraryGrid } from "@/components/studio/CoverCard";
import { LibraryHeader } from "@/components/studio/LibraryHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/db/database";
import { addCharacter, addScene } from "@/db/repo";
import { firstResultId } from "@/domain/slot";
import { CHARACTER_SLOTS, SCENE_SLOTS, type Character, type Scene } from "@/domain/types";
import { formatUpdatedAt } from "@/lib/format";
import { filterAndSortLibrary, type LibrarySort } from "@/lib/library";

function characterCover(character: Character) {
  return firstResultId(CHARACTER_SLOTS.map((slot) => character.slots?.[slot.id]));
}

function sceneCover(scene: Scene) {
  return firstResultId(SCENE_SLOTS.map((slot) => scene.slots?.[slot.id]));
}

export function CharacterLibraryPage() {
  return (
    <AssetLibraryPage
      title="角色设定"
      kind="character"
      emptyHint="角色现在还挂在项目里。选一个项目创建后，会从这里汇总进来。"
    />
  );
}

export function SceneLibraryPage() {
  return (
    <AssetLibraryPage
      title="常用场景"
      kind="scene"
      emptyHint="场景现在还挂在项目里。选一个项目创建后，会从这里汇总进来。"
    />
  );
}

function AssetLibraryPage({
  title,
  kind,
  emptyHint,
}: {
  title: string;
  kind: "character" | "scene";
  emptyHint: string;
}) {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const characters = useLiveQuery(() => db.characters.toArray(), []) ?? [];
  const scenes = useLiveQuery(() => db.scenes.toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [picking, setPicking] = useState(false);
  const [projectId, setProjectId] = useState<string>();

  const projectName = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const items =
    kind === "character"
      ? filterAndSortLibrary(characters, query, sort)
      : filterAndSortLibrary(scenes, query, sort);

  async function handleCreate() {
    if (!projectId) {
      toast.error("先选一个项目");
      return;
    }
    if (kind === "character") {
      const character = await addCharacter(projectId);
      setPicking(false);
      await navigate({
        to: "/p/$projectId/assets/characters/$characterId",
        params: { projectId, characterId: character.id },
      });
      return;
    }
    const scene = await addScene(projectId);
    setPicking(false);
    await navigate({
      to: "/p/$projectId/assets/scenes/$sceneId",
      params: { projectId, sceneId: scene.id },
    });
  }

  function openCreate() {
    if (projects.length === 0) {
      toast.error("先去创建一个项目");
      return;
    }
    setProjectId(projects[0]?.id);
    setPicking(true);
  }

  return (
    <div className="px-10 py-8">
      <LibraryHeader title={title} query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
      <p className="text-muted-foreground mt-3 max-w-xl text-[13px]">{emptyHint}</p>
      <div className="mt-8">
        <LibraryGrid>
          <CreateTile
            label={kind === "character" ? "创建角色" : "创建场景"}
            hint="先放到某个项目"
            onClick={openCreate}
          />
          {items.map((item) => (
            <CoverCard
              key={item.id}
              title={item.name}
              subtitle={`${projectName.get(item.projectId) ?? "未知项目"} · ${formatUpdatedAt(item.updatedAt)}`}
              mediaId={kind === "character" ? characterCover(item as Character) : sceneCover(item as Scene)}
              onOpen={() => {
                if (kind === "character") {
                  void navigate({
                    to: "/p/$projectId/assets/characters/$characterId",
                    params: { projectId: item.projectId, characterId: item.id },
                  });
                  return;
                }
                void navigate({
                  to: "/p/$projectId/assets/scenes/$sceneId",
                  params: { projectId: item.projectId, sceneId: item.id },
                });
              }}
            />
          ))}
        </LibraryGrid>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{kind === "character" ? "角色放到哪个项目" : "场景放到哪个项目"}</DialogTitle>
          </DialogHeader>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicking(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={() => void handleCreate()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
