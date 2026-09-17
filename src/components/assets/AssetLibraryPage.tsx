import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { db } from "@/db/database";
import { addCharacter, addScene, deleteCharacter, deleteScene } from "@/db/repo";
import { firstResultId } from "@/domain/slot";
import { CHARACTER_SLOTS, SCENE_SLOTS, type Character, type Id, type Scene } from "@/domain/types";
import { MediaPreview } from "@/components/media/MediaThumb";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorldSettingPanel } from "@/components/assets/WorldSettingPanel";

function coverOfCharacter(character: Character): Id | undefined {
  return firstResultId(CHARACTER_SLOTS.map((slot) => character.slots?.[slot.id]));
}

function coverOfScene(scene: Scene): Id | undefined {
  return firstResultId(SCENE_SLOTS.map((slot) => scene.slots?.[slot.id]));
}

type WorldTab = "setting" | "characters" | "scenes" | "props" | "styles";

export function AssetLibraryPage({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<WorldTab>("setting");
  const characters =
    useLiveQuery(
      () => db.characters.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
      [projectId],
    ) ?? [];
  const scenes =
    useLiveQuery(
      () => db.scenes.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
      [projectId],
    ) ?? [];
  const [pendingDelete, setPendingDelete] = useState<
    { type: "character" | "scene"; id: string; name: string } | undefined
  >();

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">世界</h1>
            <p className="text-muted-foreground mt-1 text-xs">
              设定是这部戏一直为真的东西。角色、场景、道具、风格是能被点名的名册。
            </p>
          </div>
          {tab === "characters" || tab === "scenes" ? (
            <Button
              size="sm"
              variant="brand"
              onClick={() => {
                if (tab === "characters") void addCharacter(projectId);
                else void addScene(projectId);
              }}
            >
              <Plus />
              {tab === "characters" ? "新建角色" : "新建场景"}
            </Button>
          ) : null}
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as WorldTab)}
          className="mt-5"
        >
          <TabsList>
            <TabsTrigger value="setting">设定</TabsTrigger>
            <TabsTrigger value="characters">角色 {characters.length}</TabsTrigger>
            <TabsTrigger value="scenes">场景 {scenes.length}</TabsTrigger>
            <TabsTrigger value="props">道具</TabsTrigger>
            <TabsTrigger value="styles">风格</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "setting" ? (
          <WorldSettingPanel projectId={projectId} />
        ) : tab === "props" ? (
          <EmptyWorldTab
            title="还没有道具"
            detail="衣服、物件、关键道具以后会做成可被项目引用的资产。现在先占位。"
          />
        ) : tab === "styles" ? (
          <EmptyWorldTab
            title="还没有风格"
            detail="画风和光色以后可以从工作室风格库引用进来，避免每部片子重新发明。现在先占位。"
          />
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {tab === "characters"
            ? characters.map((character) => (
                <li key={character.id} className="group relative">
                  <Link
                    to="/p/$projectId/assets/characters/$characterId"
                    params={{ projectId, characterId: character.id }}
                    className="bg-card block overflow-hidden rounded-2xl border"
                  >
                    <MediaPreview
                      mediaId={coverOfCharacter(character)}
                      className="h-40 w-full"
                      empty="角色"
                    />
                    <div className="px-3 py-3">
                      <p className="truncate font-medium">{character.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {character.appearance || "未填写外观"}
                      </p>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="absolute top-2 right-2 hidden rounded-full group-hover:flex"
                    onClick={() =>
                      setPendingDelete({
                        type: "character",
                        id: character.id,
                        name: character.name,
                      })
                    }
                    aria-label="删除角色"
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))
            : scenes.map((scene) => (
                <li key={scene.id} className="group relative">
                  <Link
                    to="/p/$projectId/assets/scenes/$sceneId"
                    params={{ projectId, sceneId: scene.id }}
                    className="bg-card block overflow-hidden rounded-2xl border"
                  >
                    <MediaPreview
                      mediaId={coverOfScene(scene)}
                      className="h-40 w-full"
                      empty="场景"
                    />
                    <div className="px-3 py-3">
                      <p className="truncate font-medium">{scene.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[scene.location, scene.timeOfDay].filter(Boolean).join(" · ") ||
                          "未填写地点"}
                      </p>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="absolute top-2 right-2 hidden rounded-full group-hover:flex"
                    onClick={() =>
                      setPendingDelete({
                        type: "scene",
                        id: scene.id,
                        name: scene.name,
                      })
                    }
                    aria-label="删除场景"
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.type === "scene" ? "删除场景" : "删除角色"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{pendingDelete?.name}」？分镜里的引用会被清除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDelete) return;
                if (pendingDelete.type === "character") void deleteCharacter(pendingDelete.id);
                else void deleteScene(pendingDelete.id);
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

function EmptyWorldTab({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bg-card mt-6 max-w-xl rounded-2xl border border-dashed px-5 py-8">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-2 text-xs leading-5">{detail}</p>
    </div>
  );
}
