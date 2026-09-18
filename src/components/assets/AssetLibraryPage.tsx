import { copySelection } from "@/lib/copySelection";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Library, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/db/database";
import {
  addCharacter,
  addProp,
  addScene,
  addStyle,
  copyStudioCharacter,
  copyStudioProp,
  copyStudioScene,
  copyStudioStyle,
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
  type Character,
  type Id,
  type Prop,
  type Scene,
  type VisualStyle,
} from "@/domain/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorldSettingPanel } from "@/components/assets/WorldSettingPanel";

type WorldTab = "setting" | "characters" | "scenes" | "props" | "styles";
type AssetTab = Exclude<WorldTab, "setting">;
type WorldAsset = Character | Scene | Prop | VisualStyle;

const TAB_COPY: Record<AssetTab, { singular: string; create: string }> = {
  characters: { singular: "角色", create: "新建角色" },
  scenes: { singular: "场景", create: "新建场景" },
  props: { singular: "道具", create: "新建道具" },
  styles: { singular: "风格", create: "新建风格" },
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

export function AssetLibraryPage({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<WorldTab>("setting");
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const props =
    useLiveQuery(
      () => db.props.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
      [projectId],
    ) ?? [];
  const styles =
    useLiveQuery(
      () => db.styles.where("projectId").equals(projectId).reverse().sortBy("updatedAt"),
      [projectId],
    ) ?? [];
  const [pendingDelete, setPendingDelete] = useState<
    { tab: AssetTab; id: string; name: string } | undefined
  >();

  const assets: Record<AssetTab, WorldAsset[]> = { characters, scenes, props, styles };
  const activeAssets = tab === "setting" ? [] : assets[tab];

  async function createLocal(activeTab: AssetTab) {
    if (activeTab === "characters") {
      const asset = await addCharacter(projectId);
      await navigate({
        to: "/p/$projectId/assets/characters/$characterId",
        params: { projectId, characterId: asset.id },
      });
    } else if (activeTab === "scenes") {
      const asset = await addScene(projectId);
      await navigate({
        to: "/p/$projectId/assets/scenes/$sceneId",
        params: { projectId, sceneId: asset.id },
      });
    } else if (activeTab === "props") {
      const asset = await addProp(projectId);
      await navigate({
        to: "/p/$projectId/assets/props/$propId",
        params: { projectId, propId: asset.id },
      });
    } else {
      const asset = await addStyle(projectId);
      await navigate({
        to: "/p/$projectId/assets/styles/$styleId",
        params: { projectId, styleId: asset.id },
      });
    }
  }

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
          {tab !== "setting" ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                <Library /> 从工作室添加
              </Button>
              <Button size="sm" variant="brand" onClick={() => void createLocal(tab)}>
                <Plus /> {TAB_COPY[tab].create}
              </Button>
            </div>
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
            <TabsTrigger value="props">道具 {props.length}</TabsTrigger>
            <TabsTrigger value="styles">风格 {styles.length}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "setting" ? (
          <WorldSettingPanel projectId={projectId} />
        ) : activeAssets.length === 0 ? (
          <EmptyWorldTab singular={TAB_COPY[tab].singular} />
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {activeAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                projectId={projectId}
                tab={tab}
                asset={asset}
                onDelete={() => setPendingDelete({ tab, id: asset.id, name: asset.name })}
              />
            ))}
          </ul>
        )}
      </div>

      {tab !== "setting" ? (
        <StudioAssetPicker
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
        className="h-40 w-full"
        empty={TAB_COPY[tab].singular}
      />
      <div className="px-3 py-3">
        <p className="truncate font-medium">{asset.name}</p>
        <p className="text-muted-foreground truncate text-xs">{assetDetail(asset, tab)}</p>
      </div>
    </>
  );
  return (
    <li className="group relative">
      {tab === "characters" ? (
        <Link
          to="/p/$projectId/assets/characters/$characterId"
          params={{ projectId, characterId: asset.id }}
          className="bg-card block overflow-hidden rounded-2xl border"
        >
          {card}
        </Link>
      ) : tab === "scenes" ? (
        <Link
          to="/p/$projectId/assets/scenes/$sceneId"
          params={{ projectId, sceneId: asset.id }}
          className="bg-card block overflow-hidden rounded-2xl border"
        >
          {card}
        </Link>
      ) : tab === "props" ? (
        <Link
          to="/p/$projectId/assets/props/$propId"
          params={{ projectId, propId: asset.id }}
          className="bg-card block overflow-hidden rounded-2xl border"
        >
          {card}
        </Link>
      ) : (
        <Link
          to="/p/$projectId/assets/styles/$styleId"
          params={{ projectId, styleId: asset.id }}
          className="bg-card block overflow-hidden rounded-2xl border"
        >
          {card}
        </Link>
      )}
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="absolute top-2 right-2 flex rounded-full md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100"
        onClick={onDelete}
        aria-label={`删除${TAB_COPY[tab].singular}`}
      >
        <Trash2 />
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
  const studioAssets =
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
    }, [tab]) ?? [];
  const copiedSourceIds = new Set(
    copiedAssets.map(sourceAssetId).filter((id): id is string => Boolean(id)),
  );
  const available = studioAssets.filter((asset) => !copiedSourceIds.has(asset.id));

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>从工作室添加{TAB_COPY[tab].singular}</DialogTitle>
          <DialogDescription>添加后成为项目快照，可以独立修改。</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-auto">
          {available.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              没有可添加的工作室{TAB_COPY[tab].singular}
            </p>
          ) : (
            available.map((asset) => (
              <label
                key={asset.id}
                className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-xl border p-3"
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
        <DialogFooter>
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

function EmptyWorldTab({ singular }: { singular: string }) {
  return (
    <div className="bg-card mt-6 max-w-xl rounded-2xl border border-dashed px-5 py-8">
      <p className="text-sm font-medium">还没有{singular}</p>
      <p className="text-muted-foreground mt-2 text-xs leading-5">
        可以新建，或从工作室添加一份可独立修改的快照。
      </p>
    </div>
  );
}
