import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ChevronDown,
  Columns3,
  CopyPlus,
  Filter,
  GripVertical,
  Hash,
  Images,
  LayoutList,
  Plus,
  Settings2,
  SquareStack,
  Trash2,
  Type,
  Users,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { db } from "@/db/database";
import {
  addShot,
  addShots,
  addStoryBeat,
  deleteEpisodeShots,
  deleteShots,
  deleteStoryBeat,
  duplicateShot,
  patchEpisodeShots,
  patchShot,
  patchStoryBeat,
  reorderBeats,
  reorderShots,
  restoreShots,
  restoreStoryBeat,
  setShotSlot,
  setVisibleColumns,
  updateShotSettings,
  type EpisodeShotBulkPatch,
} from "@/db/repo";
import { SHOT_COLUMNS, normalizeVisibleColumns, type ColumnDef } from "@/domain/columns";
import { emptySlot, slotMediaIds } from "@/domain/slot";
import {
  SHOT_STATUSES,
  SHOT_STATUS_LABELS,
  SHOT_UNASSIGNED_BEAT,
  normalizeEpisodeStory,
  normalizeShotSettings,
  normalizeShotStatus,
  shotFiltersActive,
  type Character,
  type GenerationSlot,
  type Id,
  type Scene,
  type Shot,
  type ShotColumnId,
  type ShotFilters,
  type ShotGapFilter,
  type ShotStatus,
  type ShotWorkspaceView,
  type StoryBeat,
} from "@/domain/types";
import { isFormFieldTarget } from "@/lib/formFieldFocus";
import { formatDuration } from "@/lib/format";
import {
  moveIdToPosition,
  reorderGroupInFullOrder,
  sameIdOrder,
} from "@/lib/reorderIds";
import { filterShots } from "@/lib/shotFilters";
import {
  beatGroupIds,
  retainVisibleSelectedIds,
  stepActiveShotId,
} from "@/lib/shotKeyboard";
import { useUndo } from "@/lib/undo";
import { cn } from "@/lib/utils";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
import { Still } from "@/components/studio/Still";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function columnPlaceholder(id: ShotColumnId): string {
  switch (id) {
    case "content":
      return "镜头内容";
    case "durationSec":
      return "秒";
    case "notes":
      return "备注";
    case "scene":
      return "未选择场景";
    case "characters":
      return "未选择角色";
    default:
      return SHOT_COLUMNS.find((column) => column.id === id)?.label ?? "";
  }
}

/** Shared shot-row height: min band + hard cap; text scrolls inside. */
const DESIGN_ROW_H = "h-full min-h-[124px] max-h-[160px]";

/** Shared shot cell chrome: capped height, content centered with vertical padding. */
const DESIGN_CELL_CHROME =
  `${DESIGN_ROW_H} flex items-center justify-center overflow-hidden px-2 py-3`;

/** Left reorder stack: centered controls with vertical padding inside the capped row. */
const SHOT_LEFT_CONTROLS =
  "box-border flex h-full max-h-[160px] min-h-[124px] flex-col items-center justify-center gap-1.5 overflow-hidden px-1 py-4";

function coverMediaId(
  slots: Partial<Record<string, GenerationSlot>> | undefined,
  preferredKeys: string[],
): Id | undefined {
  if (!slots) return undefined;
  for (const key of preferredKeys) {
    const mediaId = slots[key]?.result?.mediaId;
    if (mediaId) return mediaId;
  }
  return undefined;
}

function AssetStill({
  mediaId,
  title,
  className,
}: {
  mediaId?: Id;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("size-10 shrink-0 overflow-hidden rounded-md", className)}>
      <Still mediaId={mediaId} title={title} className="p-1.5 [&_span]:text-base" />
    </div>
  );
}

const FLUSH_SELECT_TRIGGER =
  `${DESIGN_CELL_CHROME} w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 data-[size=default]:h-full dark:bg-transparent dark:hover:bg-transparent`;

function PlainCell({
  value,
  placeholder,
  onCommit,
  chrome = false,
}: {
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
  /** Capped/centered chrome for design + media shot rows. */
  chrome?: boolean;
}) {
  return (
    <div
      className={cn(
        chrome
          ? // Full-width band: avoid justify-center + field-sizing-content shrinking to a skinny strip
            `${DESIGN_ROW_H} flex w-full min-w-0 items-center overflow-hidden px-2 py-3`
          : "h-full min-h-[124px]",
        "w-full min-h-0",
      )}
    >
      <Textarea
        value={value}
        rows={4}
        placeholder={placeholder}
        onChange={(event) => onCommit(event.target.value)}
        className={cn(
          "h-full w-full min-w-0 resize-none rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 field-sizing-fixed dark:bg-transparent",
          chrome ? "max-h-full overflow-auto" : "min-h-[124px]",
        )}
      />
    </div>
  );
}

export function ShotEditorPage({
  projectId,
  episodeId,
  focusShotId,
}: {
  projectId: string;
  episodeId: string;
  focusShotId?: string;
}) {
  const project = useLiveQuery(
    async () => (await db.projects.get(projectId)) ?? null,
    [projectId],
  );
  const episode = useLiveQuery(
    async () => (await db.episodes.get(episodeId)) ?? null,
    [episodeId],
  );
  const shots =
    useLiveQuery(
      () => db.shots.where("episodeId").equals(episodeId).sortBy("order"),
      [episodeId],
    ) ?? [];
  const characters =
    useLiveQuery(
      () => db.characters.where("projectId").equals(projectId).toArray(),
      [projectId],
    ) ?? [];
  const scenes =
    useLiveQuery(
      () => db.scenes.where("projectId").equals(projectId).toArray(),
      [projectId],
    ) ?? [];

  const visible = normalizeVisibleColumns(project?.columnSettings.visible);
  const visibleDefs = SHOT_COLUMNS.filter((column) => visible.includes(column.id));
  const shotSettings = normalizeShotSettings(project?.shotSettings);
  const workspaceView = shotSettings.workspaceView;
  const filters = shotSettings.filters;
  const filtersOn = shotFiltersActive(filters);
  const visibleShots = useMemo(() => filterShots(shots, filters), [shots, filters]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingBeatId, setPendingBeatId] = useState<string>();
  const [bulkBeatValue, setBulkBeatValue] = useState<string>();
  const [bulkDuration, setBulkDuration] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string>();
  const [bulkSceneValue, setBulkSceneValue] = useState<string>();
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkCharacterIds, setBulkCharacterIds] = useState<string[]>([]);
  const [activeShotId, setActiveShotId] = useState<string>();
  const [highlightedShotId, setHighlightedShotId] = useState<string>();
  const { registerUndo } = useUndo();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const beats = normalizeEpisodeStory(episode?.story).beats;
  const beatIdList = beats.map((beat) => beat.id);
  const grouped = beats.map((beat) => ({
    beat,
    shots: visibleShots.filter((shot) => shot.beatId === beat.id),
  }));
  // Keep SortableContext items in sync with mounted beat blocks; filtered-out
  // empty groups must not remain in the sortable id list.
  const visibleGrouped = grouped.filter(
    ({ shots: beatShots }) => !(filtersOn && beatShots.length === 0),
  );
  const ungrouped = visibleShots.filter(
    (shot) => !shot.beatId || !beats.some((beat) => beat.id === shot.beatId),
  );
  const empty = shots.length === 0 && beats.length === 0;
  const filterEmpty = !empty && filtersOn && visibleShots.length === 0;
  const visibleShotIds = useMemo(
    () => visibleShots.map((shot) => shot.id),
    [visibleShots],
  );

  const totalDuration = useMemo(
    () => visibleShots.reduce((sum, shot) => sum + (Number(shot.durationSec) || 0), 0),
    [visibleShots],
  );

  useEffect(() => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmDelete(false);
    setBulkBeatValue(undefined);
    setBulkDuration("");
    setBulkStatus(undefined);
    setBulkSceneValue(undefined);
    setBulkNotes("");
    setBulkCharacterIds([]);
    setActiveShotId(undefined);
    setHighlightedShotId(undefined);
  }, [episodeId]);

  useEffect(() => {
    if (!focusShotId || !shots.some((shot) => shot.id === focusShotId)) return;
    setHighlightedShotId(focusShotId);
    setActiveShotId(focusShotId);
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`shot-${focusShotId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setHighlightedShotId(undefined), 3000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [focusShotId, shots]);

  useEffect(() => {
    if (activeShotId && !visibleShotIds.includes(activeShotId)) {
      setActiveShotId(undefined);
    }
  }, [activeShotId, visibleShotIds]);

  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const next = retainVisibleSelectedIds(current, visibleShotIds);
      return next.size === current.size ? current : next;
    });
  }, [visibleShotIds]);

  useEffect(() => {
    if (!activeShotId) return;
    document
      .getElementById(`shot-${activeShotId}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeShotId]);

  const keyboardRef = useRef({
    visibleShotIds,
    visibleShots,
    shots,
    beatIdList,
    selected,
    activeShotId,
    projectId,
    episodeId,
    setSelecting,
    setSelected,
    setActiveShotId,
    setConfirmDelete,
    moveShotByOffset: (_shotId: string, _offset: -1 | 1) => {},
  });

  async function commitShotReorder(groupIds: string[], activeId: string, overId: string) {
    const previous = shots.map((shot) => shot.id);
    const next = reorderGroupInFullOrder(previous, groupIds, activeId, overId);
    if (!next || sameIdOrder(previous, next)) return;
    await reorderShots(episodeId, next);
    registerUndo({
      label: "已调整镜头顺序",
      restore: () => reorderShots(episodeId, previous),
    });
  }

  function moveShotByOffset(shotId: string, offset: -1 | 1) {
    const group = beatGroupIds(visibleShots, shotId, beatIdList);
    const index = group.indexOf(shotId);
    const targetId = group[index + offset];
    if (!targetId) return;
    void commitShotReorder(group, shotId, targetId);
  }

  keyboardRef.current = {
    visibleShotIds,
    visibleShots,
    shots,
    beatIdList,
    selected,
    activeShotId,
    projectId,
    episodeId,
    setSelecting,
    setSelected,
    setActiveShotId,
    setConfirmDelete,
    moveShotByOffset,
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isFormFieldTarget(event.target)) return;
      const ctx = keyboardRef.current;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key;

      if (meta && (key === "a" || key === "A")) {
        event.preventDefault();
        event.stopPropagation();
        ctx.setSelecting(true);
        ctx.setSelected(new Set(ctx.visibleShotIds));
        return;
      }

      if (event.altKey && (key === "ArrowUp" || key === "ArrowDown")) {
        event.preventDefault();
        event.stopPropagation();
        const shotId = ctx.activeShotId;
        if (!shotId) return;
        ctx.moveShotByOffset(shotId, key === "ArrowUp" ? -1 : 1);
        return;
      }

      if (meta || event.altKey) return;

      if (key === "j" || key === "ArrowDown" || key === "k" || key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const direction: -1 | 1 = key === "j" || key === "ArrowDown" ? 1 : -1;
        const next = stepActiveShotId(ctx.visibleShotIds, ctx.activeShotId, direction);
        ctx.setActiveShotId(next);
        return;
      }

      if (key === " " || key === "x" || key === "X") {
        event.preventDefault();
        event.stopPropagation();
        const shotId = ctx.activeShotId;
        if (!shotId || !ctx.visibleShotIds.includes(shotId)) return;
        ctx.setSelecting(true);
        ctx.setSelected((current) => {
          const next = new Set(current);
          if (next.has(shotId)) next.delete(shotId);
          else next.add(shotId);
          return next;
        });
        return;
      }

      if (key === "n" || key === "N") {
        event.preventDefault();
        event.stopPropagation();
        const active = ctx.shots.find((shot) => shot.id === ctx.activeShotId);
        void addShot(ctx.projectId, ctx.episodeId, {
          beatId: active?.beatId,
        });
        return;
      }

      if (key === "Backspace") {
        if (ctx.selected.size === 0) return;
        event.preventDefault();
        event.stopPropagation();
        ctx.setConfirmDelete(true);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  async function persistFilters(next: ShotFilters) {
    await updateShotSettings(projectId, { filters: next });
  }

  function toggleFilterStatus(status: ShotStatus) {
    const statuses = filters.statuses.includes(status)
      ? filters.statuses.filter((item) => item !== status)
      : [...filters.statuses, status];
    void persistFilters({ ...filters, statuses });
  }

  function toggleFilterBeat(beatId: string) {
    const beatIds = filters.beatIds.includes(beatId)
      ? filters.beatIds.filter((item) => item !== beatId)
      : [...filters.beatIds, beatId];
    void persistFilters({ ...filters, beatIds });
  }

  function toggleFilterGap(gap: ShotGapFilter) {
    const gaps = filters.gaps.includes(gap)
      ? filters.gaps.filter((item) => item !== gap)
      : [...filters.gaps, gap];
    void persistFilters({ ...filters, gaps });
  }

  if (project === undefined || episode === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载分镜…</div>;
  }
  if (project === null) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这个项目</div>;
  }
  if (episode === null || episode.projectId !== projectId) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这一集</div>;
  }

  async function toggleColumn(id: ShotColumnId, next: boolean) {
    const current = visible.includes(id);
    if (next === current) return;
    await setVisibleColumns(
      projectId,
      next ? [...visible, id] : visible.filter((item) => item !== id),
    );
  }

  async function onBeatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const previous = beats.map((beat) => beat.id);
    const next = moveIdToPosition(previous, String(active.id), String(over.id));
    if (!next || sameIdOrder(previous, next)) return;
    await reorderBeats(episodeId, next);
    registerUndo({
      label: "已调整场次顺序",
      restore: () => reorderBeats(episodeId, previous),
    });
  }

  async function removeSelectedShots() {
    const snapshot = shots.filter((shot) => selected.has(shot.id));
    const mediaIds = new Set(
      snapshot.flatMap((shot) => [
        ...slotMediaIds(shot.firstFrame),
        ...slotMediaIds(shot.lastFrame),
        ...slotMediaIds(shot.clip),
      ]),
    );
    const media = (await db.media.bulkGet([...mediaIds])).filter((item) => item !== undefined);
    await deleteEpisodeShots(episodeId, snapshot.map((shot) => shot.id));
    registerUndo({
      label: `已删除 ${snapshot.length} 个镜头`,
      restore: () => restoreShots(snapshot, media),
    });
    setSelected(new Set());
  }

  async function applyBulkPatch(label: string, patch: EpisodeShotBulkPatch) {
    const snapshot = shots.filter((shot) => selected.has(shot.id));
    if (snapshot.length === 0) return;
    await patchEpisodeShots(
      episodeId,
      snapshot.map((shot) => shot.id),
      patch,
    );
    registerUndo({
      label,
      restore: async () => {
        await Promise.all(
          snapshot.map((shot) => {
            const previous: EpisodeShotBulkPatch = {};
            if ("beatId" in patch) previous.beatId = shot.beatId;
            if ("durationSec" in patch) previous.durationSec = shot.durationSec;
            if ("status" in patch) previous.status = normalizeShotStatus(shot.status);
            if ("characterIds" in patch) {
              previous.characterIds = [...(shot.characterIds ?? [])];
            }
            if ("sceneId" in patch) previous.sceneId = shot.sceneId;
            if ("notes" in patch) previous.notes = shot.notes;
            return patchShot(shot.id, previous);
          }),
        );
      },
    });
  }

  async function assignSelectedBeat(beatId: string | undefined) {
    try {
      await applyBulkPatch(`已调整 ${selected.size} 个镜头的场次`, { beatId });
    } finally {
      setBulkBeatValue(undefined);
    }
  }

  async function setSelectedDuration() {
    const durationSec = Math.max(0, Number(bulkDuration) || 0);
    await applyBulkPatch(`已调整 ${selected.size} 个镜头的时长`, { durationSec });
    setBulkDuration("");
  }

  async function assignSelectedStatus(status: ShotStatus) {
    try {
      await applyBulkPatch(`已调整 ${selected.size} 个镜头的状态`, { status });
    } finally {
      setBulkStatus(undefined);
    }
  }

  async function assignSelectedScene(sceneId: string | undefined) {
    try {
      await applyBulkPatch(`已调整 ${selected.size} 个镜头的场景`, { sceneId });
    } finally {
      setBulkSceneValue(undefined);
    }
  }

  async function assignSelectedNotes() {
    await applyBulkPatch(`已调整 ${selected.size} 个镜头的备注`, { notes: bulkNotes });
    setBulkNotes("");
  }

  async function assignSelectedCharacters() {
    await applyBulkPatch(`已调整 ${selected.size} 个镜头的角色`, {
      characterIds: [...bulkCharacterIds],
    });
  }

  function selectAllVisible() {
    setSelecting(true);
    setSelected(new Set(visibleShotIds));
  }

  async function setWorkspaceView(next: ShotWorkspaceView) {
    await updateShotSettings(projectId, { workspaceView: next });
  }

  async function removeBeat(beatId: string) {
    const index = beats.findIndex((beat) => beat.id === beatId);
    const beat = beats[index];
    if (!beat) return;
    const shotIds = shots.filter((shot) => shot.beatId === beatId).map((shot) => shot.id);
    await deleteStoryBeat(episodeId, beatId);
    registerUndo({
      label: "已删除场次",
      restore: () => restoreStoryBeat(episodeId, beat, index, shotIds),
    });
    setPendingBeatId(undefined);
  }

  async function copyShot(shotId: string) {
    const copy = await duplicateShot(shotId);
    registerUndo({
      label: "已复制镜头",
      restore: () => deleteShots([copy.id]),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-semibold">制作分镜</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="brand">
                <Plus />
                新建
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => void addShot(projectId, episodeId)}>
                <Plus />
                创建分镜
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void addShots(projectId, episodeId, 5)}>
                <CopyPlus />
                创建5个分镜
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void addShots(projectId, episodeId, 10)}>
                <CopyPlus />
                创建10个分镜
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void addStoryBeat(episodeId)}>
                <SquareStack />
                创建场
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="bg-muted flex rounded-md p-0.5"
            role="group"
            aria-label="分镜视图"
          >
            <Button
              size="sm"
              variant={workspaceView === "design" ? "secondary" : "ghost"}
              aria-pressed={workspaceView === "design"}
              onClick={() => void setWorkspaceView("design")}
            >
              <LayoutList />
              设计
            </Button>
            <Button
              size="sm"
              variant={workspaceView === "media" ? "secondary" : "ghost"}
              aria-pressed={workspaceView === "media"}
              onClick={() => void setWorkspaceView("media")}
            >
              <Images />
              素材
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={filtersOn ? "secondary" : "ghost"}>
                <Filter />
                筛选
                {filtersOn ? (
                  <span className="text-muted-foreground text-xs">
                    {visibleShots.length}/{shots.length}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center justify-between">
                状态
                {filters.statuses.length > 0 ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs font-normal"
                    onClick={() => void persistFilters({ ...filters, statuses: [] })}
                  >
                    清除
                  </button>
                ) : null}
              </DropdownMenuLabel>
              {SHOT_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filters.statuses.includes(status)}
                  onCheckedChange={() => toggleFilterStatus(status)}
                >
                  {SHOT_STATUS_LABELS[status]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center justify-between">
                场次
                {filters.beatIds.length > 0 ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs font-normal"
                    onClick={() => void persistFilters({ ...filters, beatIds: [] })}
                  >
                    清除
                  </button>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={filters.beatIds.includes(SHOT_UNASSIGNED_BEAT)}
                onCheckedChange={() => toggleFilterBeat(SHOT_UNASSIGNED_BEAT)}
              >
                未分场
              </DropdownMenuCheckboxItem>
              {beats.map((beat) => (
                <DropdownMenuCheckboxItem
                  key={beat.id}
                  checked={filters.beatIds.includes(beat.id)}
                  onCheckedChange={() => toggleFilterBeat(beat.id)}
                >
                  {beat.title || "未命名场"}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center justify-between">
                缺口
                {filters.gaps.length > 0 ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs font-normal"
                    onClick={() => void persistFilters({ ...filters, gaps: [] })}
                  >
                    清除
                  </button>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={filters.gaps.includes("missingFirstFrame")}
                onCheckedChange={() => toggleFilterGap("missingFirstFrame")}
              >
                缺首帧
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.gaps.includes("missingClip")}
                onCheckedChange={() => toggleFilterGap("missingClip")}
              >
                缺成片
              </DropdownMenuCheckboxItem>
              {filtersOn ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      void persistFilters({ statuses: [], beatIds: [], gaps: [] })
                    }
                  >
                    清除全部筛选
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant={selecting ? "secondary" : "ghost"}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting((value) => !value);
              setSelected(new Set());
            }}
          >
            <CheckSquare />
            选择
          </Button>
          {selecting ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={selected.size === 0}
              onClick={() => setConfirmDelete(true)}
            >
              删除所选
            </Button>
          ) : null}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <Settings2 />
                分镜设置
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>默认时长（秒）</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-20"
                  value={shotSettings.defaultDurationSec}
                  onChange={(event) =>
                    void updateShotSettings(projectId, {
                      defaultDurationSec: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="auto-shot-number">镜号自动递增</Label>
                <Checkbox
                  id="auto-shot-number"
                  checked={shotSettings.autoIncrementShotNumber}
                  onCheckedChange={(checked) =>
                    void updateShotSettings(projectId, {
                      autoIncrementShotNumber: checked === true,
                    })
                  }
                />
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Columns3 />
                列设置
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center justify-between">
                列设置
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs font-normal"
                  onClick={() =>
                    void setVisibleColumns(
                      projectId,
                      SHOT_COLUMNS.map((column) => column.id),
                    )
                  }
                >
                  全部显示
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SHOT_COLUMNS.map((column) => {
                const Icon =
                  column.kind === "number" ? Hash : column.kind === "select" ? Users : Type;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={visible.includes(column.id)}
                    onCheckedChange={(checked) => void toggleColumn(column.id, checked)}
                  >
                    <Icon className="text-muted-foreground" />
                    {column.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selecting ? (
        <div className="bg-muted/60 flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-y px-5 py-2">
          <span className="text-sm font-medium">已选 {selected.size} 个镜头</span>
          <Button
            size="sm"
            variant="outline"
            disabled={visibleShotIds.length === 0}
            onClick={selectAllVisible}
          >
            全选可见
          </Button>
          <Select
            disabled={selected.size === 0}
            value={bulkStatus}
            onValueChange={(value) => {
              setBulkStatus(value);
              void assignSelectedStatus(normalizeShotStatus(value));
            }}
          >
            <SelectTrigger className="h-8 w-32 bg-background">
              <SelectValue placeholder="批量状态" />
            </SelectTrigger>
            <SelectContent>
              {SHOT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {SHOT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            disabled={selected.size === 0}
            value={bulkBeatValue}
            onValueChange={(value) => {
              setBulkBeatValue(value);
              void assignSelectedBeat(value === "none" ? undefined : value);
            }}
          >
            <SelectTrigger className="h-8 w-40 bg-background">
              <SelectValue placeholder="批量调整场次" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未分场</SelectItem>
              {beats.map((beat) => (
                <SelectItem key={beat.id} value={beat.id}>
                  {beat.title || "未命名场"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            disabled={selected.size === 0}
            value={bulkSceneValue}
            onValueChange={(value) => {
              setBulkSceneValue(value);
              void assignSelectedScene(value === "none" ? undefined : value);
            }}
          >
            <SelectTrigger className="h-8 w-40 bg-background">
              <SelectValue placeholder="批量场景" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未选择</SelectItem>
              {scenes.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  {scene.name || "未命名场景"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={selected.size === 0}>
                <Users />
                批量角色
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-3">
              <p className="text-sm font-medium">替换所选镜头的角色</p>
              <div className="flex max-h-48 flex-col gap-1 overflow-auto">
                {characters.length === 0 ? (
                  <p className="text-muted-foreground text-xs">项目里还没有角色</p>
                ) : (
                  characters.map((character) => (
                    <label key={character.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={bulkCharacterIds.includes(character.id)}
                        onCheckedChange={(checked) => {
                          setBulkCharacterIds((current) =>
                            checked
                              ? [...current, character.id]
                              : current.filter((id) => id !== character.id),
                          );
                        }}
                      />
                      {character.name || "未命名角色"}
                    </label>
                  ))
                )}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={selected.size === 0}
                onClick={() => void assignSelectedCharacters()}
              >
                应用角色
              </Button>
            </PopoverContent>
          </Popover>
          <Input
            type="number"
            min={0}
            aria-label="批量设置时长（秒）"
            className="h-8 w-28 bg-background"
            value={bulkDuration}
            placeholder="时长（秒）"
            disabled={selected.size === 0}
            onChange={(event) => setBulkDuration(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && bulkDuration !== "") void setSelectedDuration();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || bulkDuration === ""}
            onClick={() => void setSelectedDuration()}
          >
            应用时长
          </Button>
          <Input
            aria-label="批量设置备注"
            className="h-8 w-40 bg-background"
            value={bulkNotes}
            placeholder="备注"
            disabled={selected.size === 0}
            onChange={(event) => setBulkNotes(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void assignSelectedNotes();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => void assignSelectedNotes()}
          >
            应用备注
          </Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div className="app-scroll h-full overflow-auto">
          <div
            className={cn(
              "pb-16",
              // Media rows use 1fr columns and must fill the scrollport; design keeps min-w-max for many cols.
              workspaceView === "media" ? "w-full min-w-0" : "min-w-max",
            )}
          >
            <div
              className="bg-muted text-muted-foreground grid items-stretch border-y text-xs"
              style={{
                gridTemplateColumns: gridColumns(workspaceView, visibleDefs),
              }}
            >
              {(workspaceView === "media"
                ? ["顺序", "镜号", "状态", "首帧", "尾帧", "成片", "内容"]
                : ["顺序", "镜号", "状态", ...visibleDefs.map((column) => column.label)]
              ).map(
                (label) => (
                  <div key={label} className="px-3 py-2.5">
                    {label}
                  </div>
                ),
              )}
            </div>

            {empty ? (
              <div className="text-muted-foreground flex h-52 flex-col items-center justify-center text-sm">
                还没有镜头，点击「新建」添加第一条
              </div>
            ) : null}

            {filterEmpty ? (
              <div className="text-muted-foreground flex h-52 flex-col items-center justify-center gap-3 text-sm">
                没有符合当前筛选的镜头
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void persistFilters({ statuses: [], beatIds: [], gaps: [] })
                  }
                >
                  清除筛选
                </Button>
              </div>
            ) : null}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void onBeatDragEnd(event)}
            >
              <SortableContext
                items={visibleGrouped.map(({ beat }) => beat.id)}
                strategy={verticalListSortingStrategy}
              >
                {visibleGrouped.map(({ beat, shots: beatShots }) => (
                  <BeatBlock
                    key={beat.id}
                    beat={beat}
                    shots={beatShots}
                    projectId={projectId}
                    episodeId={episodeId}
                    selecting={selecting}
                    selected={selected}
                    setSelected={setSelected}
                    activeShotId={activeShotId}
                    setActiveShotId={setActiveShotId}
                    workspaceView={workspaceView}
                    visibleDefs={visibleDefs}
                    characters={characters}
                    scenes={scenes}
                    highlightedShotId={highlightedShotId}
                    sortable
                    sensors={sensors}
                    onDeleteBeat={() => setPendingBeatId(beat.id)}
                    onReorderShots={commitShotReorder}
                    onDuplicateShot={(shotId) => void copyShot(shotId)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {!filterEmpty && ungrouped.length > 0 ? (
              <BeatBlock
                beat={{ id: "", title: "未分场", content: "", characterIds: [], timeOfDay: "" }}
                shots={ungrouped}
                projectId={projectId}
                episodeId={episodeId}
                selecting={selecting}
                selected={selected}
                setSelected={setSelected}
                activeShotId={activeShotId}
                setActiveShotId={setActiveShotId}
                workspaceView={workspaceView}
                visibleDefs={visibleDefs}
                characters={characters}
                scenes={scenes}
                highlightedShotId={highlightedShotId}
                loose
                hideHeader={beats.length === 0}
                sensors={sensors}
                onReorderShots={commitShotReorder}
                onDuplicateShot={(shotId) => void copyShot(shotId)}
              />
            ) : null}
          </div>
        </div>

        <div className="text-muted-foreground pointer-events-none absolute bottom-3 left-4 text-xs">
          镜头总数 {filtersOn ? `${visibleShots.length}/${shots.length}` : shots.length}
          <span className="mx-3">总时长 {formatDuration(totalDuration)}</span>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除镜头</AlertDialogTitle>
            <AlertDialogDescription>将删除 {selected.size} 个镜头。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                void removeSelectedShots();
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingBeatId)}
        onOpenChange={(open) => !open && setPendingBeatId(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这场</AlertDialogTitle>
            <AlertDialogDescription>
              场会去掉，镜头还在，变成未分场。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (!pendingBeatId) return;
                void removeBeat(pendingBeatId);
              }}
            >
              删除场
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function gridColumns(workspaceView: ShotWorkspaceView, visibleDefs: ColumnDef[]) {
  // Media: keep frame/clip tiles at a fixed band; only 内容 grows with the viewport.
  if (workspaceView === "media") {
    return "52px 64px 108px 220px 220px 220px minmax(220px, 1fr)";
  }
  return `52px 64px 108px ${visibleDefs.map((column) => `${column.width}px`).join(" ")}`;
}

type BeatBlockProps = {
  beat: StoryBeat;
  shots: Shot[];
  projectId: string;
  episodeId: string;
  selecting: boolean;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  activeShotId?: string;
  setActiveShotId: Dispatch<SetStateAction<string | undefined>>;
  workspaceView: ShotWorkspaceView;
  visibleDefs: ColumnDef[];
  characters: Character[];
  scenes: Scene[];
  highlightedShotId?: string;
  loose?: boolean;
  hideHeader?: boolean;
  sortable?: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDeleteBeat?: () => void;
  onReorderShots: (groupIds: string[], activeId: string, overId: string) => Promise<void>;
  onDuplicateShot: (shotId: string) => void;
};

function BeatBlock(props: BeatBlockProps) {
  if (props.sortable) return <SortableBeatBlock {...props} />;
  return <BeatBlockView {...props} />;
}

function SortableBeatBlock(props: BeatBlockProps) {
  const sortable = useSortable({ id: props.beat.id, disabled: props.selecting });
  return <BeatBlockView {...props} sortableState={sortable} />;
}

function BeatBlockView({
  beat,
  shots,
  projectId,
  episodeId,
  selecting,
  selected,
  setSelected,
  activeShotId,
  setActiveShotId,
  workspaceView,
  visibleDefs,
  characters,
  scenes,
  highlightedShotId,
  loose,
  hideHeader,
  sensors,
  onDeleteBeat,
  onReorderShots,
  onDuplicateShot,
  sortableState,
}: BeatBlockProps & {
  sortableState?: ReturnType<typeof useSortable>;
}) {
  const duration = shots.reduce((sum, shot) => sum + (Number(shot.durationSec) || 0), 0);
  const shotIds = shots.map((shot) => shot.id);
  const style: CSSProperties | undefined = sortableState
    ? {
        transform: CSS.Transform.toString(sortableState.transform),
        transition: sortableState.transition,
        opacity: sortableState.isDragging ? 0.72 : undefined,
        position: sortableState.isDragging ? "relative" : undefined,
        zIndex: sortableState.isDragging ? 20 : undefined,
      }
    : undefined;

  async function onShotDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    await onReorderShots(shotIds, String(active.id), String(over.id));
  }

  return (
    <section ref={sortableState?.setNodeRef} style={style}>
      {hideHeader ? null : (
        <div className="bg-muted/70 flex min-w-max items-center gap-2 border-b px-3 py-2">
          {sortableState && !selecting ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
              aria-label="拖拽调整场次顺序"
              {...sortableState.attributes}
              {...sortableState.listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : (
            <SquareStack className="text-muted-foreground size-3.5 shrink-0" />
          )}
          {loose ? (
            <p className="text-sm font-medium">未分场</p>
          ) : (
            <Input
              value={beat.title}
              onChange={(event) =>
                void patchStoryBeat(episodeId, beat.id, { title: event.target.value })
              }
              className="h-8 max-w-xs"
            />
          )}
          <p className="text-muted-foreground text-xs">
            {shots.length} 镜 · {formatDuration(duration)}
          </p>
          {loose ? null : (
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              aria-label="删除场"
              onClick={onDeleteBeat}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
      {shots.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-3 border-b px-4 py-6 text-xs">
          这场还没有镜头
          <Button
            size="sm"
            variant="outline"
            onClick={() => void addShot(projectId, episodeId, { beatId: beat.id })}
          >
            <Plus />
            添加镜头
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void onShotDragEnd(event)}
        >
          <SortableContext items={shotIds} strategy={verticalListSortingStrategy}>
            {shots.map((shot, index) => (
              <ShotRow
                key={shot.id}
                shot={shot}
                striped={index % 2 === 1}
                projectId={projectId}
                episodeId={episodeId}
                selecting={selecting}
                selected={selected}
                setSelected={setSelected}
                active={activeShotId === shot.id || highlightedShotId === shot.id}
                onActivate={() => setActiveShotId(shot.id)}
                workspaceView={workspaceView}
                visibleDefs={visibleDefs}
                characters={characters}
                scenes={scenes}
                beatId={loose ? undefined : beat.id}
                showBelow={index === shots.length - 1}
                canMoveUp={index > 0}
                canMoveDown={index < shots.length - 1}
                onMove={(offset) => {
                  const target = shots[index + offset];
                  if (target) void onReorderShots(shotIds, shot.id, target.id);
                }}
                onDuplicate={() => onDuplicateShot(shot.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function ShotRow({
  shot,
  striped,
  projectId,
  episodeId,
  selecting,
  selected,
  setSelected,
  active,
  onActivate,
  workspaceView,
  visibleDefs,
  characters,
  scenes,
  beatId,
  showBelow,
  canMoveUp,
  canMoveDown,
  onMove,
  onDuplicate,
}: {
  shot: Shot;
  striped: boolean;
  projectId: string;
  episodeId: string;
  selecting: boolean;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  active?: boolean;
  onActivate: () => void;
  workspaceView: ShotWorkspaceView;
  visibleDefs: ColumnDef[];
  characters: Character[];
  scenes: Scene[];
  beatId?: string;
  showBelow?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id, disabled: selecting });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const selectedScene = scenes.find((scene) => scene.id === shot.sceneId);
  const selectedCharacters = characters.filter((character) =>
    shot.characterIds.includes(character.id),
  );

  return (
    <div
      id={`shot-${shot.id}`}
      ref={setNodeRef}
      style={style}
      className={`group relative scroll-m-20 transition-shadow duration-300 ${
        active ? "z-10 overflow-visible" : ""
      }`}
      onMouseDown={onActivate}
      onFocusCapture={onActivate}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="absolute top-0 left-3.5 z-10 size-6 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() =>
          void addShot(projectId, episodeId, {
            atOrder: shot.order,
            beatId: beatId ?? shot.beatId,
          })
        }
        aria-label="在上方插入镜头"
      >
        <Plus />
      </Button>
      <div
        className={cn(
          "grid max-h-[160px] items-stretch border-b",
          striped ? "bg-muted/40" : "bg-background",
          active && "ring-2 ring-inset ring-brand",
        )}
        style={{ gridTemplateColumns: gridColumns(workspaceView, visibleDefs) }}
      >
        <div className={SHOT_LEFT_CONTROLS}>
          {selecting ? (
            <Checkbox
              aria-label={`选择镜头 ${shot.shotNumber}`}
              checked={selected.has(shot.id)}
              onCheckedChange={(checked) => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (checked) next.add(shot.id);
                  else next.delete(shot.id);
                  return next;
                });
              }}
            />
          ) : (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-6"
                aria-label="上移镜头"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
              >
                <ArrowUp />
              </Button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex size-6 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
                aria-label="拖拽调整镜头顺序"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-3.5" />
              </button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-6"
                aria-label="下移镜头"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-6"
                aria-label="复制镜头"
                onClick={onDuplicate}
              >
                <CopyPlus />
              </Button>
            </>
          )}
        </div>
        <div className={DESIGN_CELL_CHROME}>
          <Input
            value={shot.shotNumber}
            onChange={(event) => void patchShot(shot.id, { shotNumber: event.target.value })}
            className="h-8 w-10 border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
          />
        </div>
        <div className={cn(DESIGN_CELL_CHROME, "border-l")}>
          <Select
            value={normalizeShotStatus(shot.status)}
            onValueChange={(value) =>
              void patchShot(shot.id, { status: normalizeShotStatus(value) })
            }
          >
            <SelectTrigger className="h-8 w-full border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHOT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {SHOT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {workspaceView === "media" ? (
          <>
            <div className={cn(DESIGN_CELL_CHROME, "w-full")}>
              <EditableGenerationSlot
                projectId={projectId}
                slot={shot.firstFrame ?? emptySlot()}
                variant="frame"
                size="row"
                title={`镜头 ${shot.shotNumber} · 首帧`}
                onSave={(slot) => void setShotSlot(shot.id, "firstFrame", slot)}
              />
            </div>
            <div className={cn(DESIGN_CELL_CHROME, "w-full border-l")}>
              <EditableGenerationSlot
                projectId={projectId}
                slot={shot.lastFrame ?? emptySlot()}
                variant="frame"
                size="row"
                title={`镜头 ${shot.shotNumber} · 尾帧`}
                onSave={(slot) => void setShotSlot(shot.id, "lastFrame", slot)}
              />
            </div>
            <div className={cn(DESIGN_CELL_CHROME, "w-full border-l")}>
              <EditableGenerationSlot
                projectId={projectId}
                slot={shot.clip ?? emptySlot()}
                variant="clip"
                size="row"
                title={`镜头 ${shot.shotNumber} · 成片`}
                onSave={(slot) => void setShotSlot(shot.id, "clip", slot)}
              />
            </div>
            <div className="flex h-full min-w-0 border-l">
              <PlainCell
                chrome
                value={shot.content}
                placeholder={columnPlaceholder("content")}
                onCommit={(content) => void patchShot(shot.id, { content })}
              />
            </div>
          </>
        ) : visibleDefs.map((column) => (
          <div key={column.id} className="flex h-full min-h-0 min-w-0 border-l">
            {column.id === "durationSec" ? (
              <div className={cn(DESIGN_CELL_CHROME, "w-full")}>
                <Input
                  value={String(shot.durationSec || "")}
                  placeholder={columnPlaceholder("durationSec")}
                  onChange={(event) =>
                    void patchShot(shot.id, {
                      durationSec: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  className="h-8 w-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
            ) : column.id === "characters" ? (
              <DropdownMenu
                onOpenChange={(open) => {
                  if (open) onActivate();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="选择角色"
                    className={cn(
                      FLUSH_SELECT_TRIGGER,
                      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
                      {characters.length === 0 ? (
                        <span className="text-muted-foreground text-sm">先在世界里添加角色</span>
                      ) : selectedCharacters.length === 0 ? (
                        <span className="text-muted-foreground text-sm">
                          {columnPlaceholder("characters")}
                        </span>
                      ) : selectedCharacters.length === 1 ? (
                        <>
                          <AssetStill
                            mediaId={coverMediaId(selectedCharacters[0].slots, ["front"])}
                            title={selectedCharacters[0].name}
                            className="size-16"
                          />
                          <span
                            title={selectedCharacters[0].name}
                            className="text-muted-foreground max-w-full truncate text-center text-[10px] leading-none"
                          >
                            {selectedCharacters[0].name}
                          </span>
                        </>
                      ) : (
                        <>
                          <AssetStill
                            mediaId={coverMediaId(selectedCharacters[0].slots, ["front"])}
                            title={selectedCharacters[0].name}
                            className="size-16"
                          />
                          <span
                            title={selectedCharacters.map((c) => c.name).join("、")}
                            className="text-muted-foreground max-w-full truncate text-center text-[10px] leading-none"
                          >
                            角色 · {selectedCharacters.length}
                          </span>
                        </>
                      )}
                    </span>
                    <ChevronDown className="size-4 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {characters.length === 0 ? (
                    <DropdownMenuItem disabled>先在世界里添加角色</DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem
                        disabled={selectedCharacters.length === 0}
                        onSelect={(event) => {
                          event.preventDefault();
                          onActivate();
                          void patchShot(shot.id, { characterIds: [] });
                        }}
                      >
                        清除
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {characters.map((character) => {
                        const selectedChar = shot.characterIds.includes(character.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={character.id}
                            checked={selectedChar}
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={(checked) => {
                              onActivate();
                              const ids = checked
                                ? selectedChar
                                  ? shot.characterIds
                                  : [...shot.characterIds, character.id]
                                : shot.characterIds.filter((id) => id !== character.id);
                              void patchShot(shot.id, { characterIds: ids });
                            }}
                          >
                            <AssetStill
                              mediaId={coverMediaId(character.slots, ["front"])}
                              title={character.name}
                              className="size-8"
                            />
                            <span className="truncate">{character.name}</span>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : column.id === "scene" ? (
              <Select
                value={shot.sceneId ?? "none"}
                onValueChange={(value) =>
                  void patchShot(shot.id, {
                    sceneId: value === "none" ? undefined : value,
                  })
                }
                onOpenChange={(open) => {
                  if (open) onActivate();
                }}
              >
                <SelectTrigger className={FLUSH_SELECT_TRIGGER}>
                  <span className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
                    {selectedScene ? (
                      <>
                        <AssetStill
                          mediaId={coverMediaId(selectedScene.slots, ["wide"])}
                          title={selectedScene.name}
                          className="size-16"
                        />
                        <span
                          title={selectedScene.name}
                          className="text-muted-foreground max-w-full truncate text-center text-[10px] leading-none"
                        >
                          {selectedScene.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {columnPlaceholder("scene")}
                      </span>
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未选择场景</SelectItem>
                  {scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      <AssetStill
                        mediaId={coverMediaId(scene.slots, ["wide"])}
                        title={scene.name}
                        className="size-8"
                      />
                      <span className="truncate">{scene.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <PlainCell
                chrome
                value={String(shot[column.id as keyof Shot] ?? "")}
                placeholder={columnPlaceholder(column.id)}
                onCommit={(value) =>
                  void patchShot(shot.id, { [column.id]: value } as Partial<Shot>)
                }
              />
            )}
          </div>
        ))}
      </div>
      {showBelow ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="absolute bottom-0 left-3.5 z-10 size-6 translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => void addShot(projectId, episodeId, { beatId })}
          aria-label="在末尾添加镜头"
        >
          <Plus />
        </Button>
      ) : null}
    </div>
  );
}
