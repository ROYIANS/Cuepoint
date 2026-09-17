import { useLiveQuery } from "dexie-react-hooks";
import {
  CheckSquare,
  ChevronDown,
  Columns3,
  CopyPlus,
  GripVertical,
  Hash,
  Plus,
  Settings2,
  SquareStack,
  Trash2,
  Type,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { db } from "@/db/database";
import {
  addShot,
  addShots,
  addStoryBeat,
  deleteShots,
  deleteStoryBeat,
  patchShot,
  patchStoryBeat,
  setShotSlot,
  setVisibleColumns,
  updateProject,
} from "@/db/repo";
import { SHOT_COLUMNS, normalizeVisibleColumns, type ColumnDef } from "@/domain/columns";
import { emptySlot } from "@/domain/slot";
import { normalizeEpisodeStory, type Shot, type ShotColumnId, type StoryBeat } from "@/domain/types";
import { formatDuration } from "@/lib/format";
import { EditableGenerationSlot } from "@/components/slots/GenerationSlotCard";
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

function PlainCell({
  value,
  placeholder = "插入内容",
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <Textarea
      value={value}
      rows={4}
      placeholder={placeholder}
      onChange={(event) => onCommit(event.target.value)}
      className="h-[124px] resize-none rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
    />
  );
}

export function ShotEditorPage({
  projectId,
  episodeId,
}: {
  projectId: string;
  episodeId: string;
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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingBeatId, setPendingBeatId] = useState<string>();

  const beats = normalizeEpisodeStory(episode?.story).beats;
  const grouped = beats.map((beat) => ({
    beat,
    shots: shots.filter((shot) => shot.beatId === beat.id),
  }));
  const ungrouped = shots.filter(
    (shot) => !shot.beatId || !beats.some((beat) => beat.id === shot.beatId),
  );
  const empty = shots.length === 0 && beats.length === 0;

  const totalDuration = useMemo(
    () => shots.reduce((sum, shot) => sum + (Number(shot.durationSec) || 0), 0),
    [shots],
  );

  if (project === undefined || episode === undefined) {
    return <div className="text-muted-foreground p-8 text-sm">加载分镜…</div>;
  }
  if (project === null) {
    return <div className="text-muted-foreground p-8 text-sm">找不到这个项目</div>;
  }
  if (episode === null) {
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
              <DropdownMenuItem onClick={() => void addShot(episodeId)}>
                <Plus />
                创建分镜
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void addShots(episodeId, 5)}>
                <CopyPlus />
                创建5个分镜
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void addShots(episodeId, 10)}>
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
          <Button
            size="sm"
            variant={selecting ? "secondary" : "ghost"}
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
                  value={project.shotSettings.defaultDurationSec}
                  onChange={(event) =>
                    void updateProject(projectId, {
                      shotSettings: {
                        ...project.shotSettings,
                        defaultDurationSec: Math.max(0, Number(event.target.value) || 0),
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="auto-shot-number">镜号自动递增</Label>
                <Checkbox
                  id="auto-shot-number"
                  checked={project.shotSettings.autoIncrementShotNumber}
                  onCheckedChange={(checked) =>
                    void updateProject(projectId, {
                      shotSettings: {
                        ...project.shotSettings,
                        autoIncrementShotNumber: checked === true,
                      },
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

      <div className="relative min-h-0 flex-1">
        <div className="app-scroll h-full overflow-auto">
          <div className="min-w-max pb-16">
            <div
              className="bg-muted text-muted-foreground grid items-stretch border-y text-xs"
              style={{
                gridTemplateColumns: `52px 64px 248px 248px 248px ${visibleDefs
                  .map((column) => `${column.width}px`)
                  .join(" ")}`,
              }}
            >
              {["顺序", "镜号", "首帧", "尾帧", "成片", ...visibleDefs.map((column) => column.label)].map(
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

            {grouped.map(({ beat, shots: beatShots }) => (
              <BeatBlock
                key={beat.id}
                beat={beat}
                shots={beatShots}
                projectId={projectId}
                episodeId={episodeId}
                selecting={selecting}
                selected={selected}
                setSelected={setSelected}
                visibleDefs={visibleDefs}
                characters={characters}
                scenes={scenes}
                onDeleteBeat={() => setPendingBeatId(beat.id)}
              />
            ))}

            {ungrouped.length > 0 ? (
              <BeatBlock
                beat={{ id: "", title: "未分场", content: "", characterIds: [], timeOfDay: "" }}
                shots={ungrouped}
                projectId={projectId}
                episodeId={episodeId}
                selecting={selecting}
                selected={selected}
                setSelected={setSelected}
                visibleDefs={visibleDefs}
                characters={characters}
                scenes={scenes}
                loose
                hideHeader={beats.length === 0}
              />
            ) : null}
          </div>
        </div>

        <div className="text-muted-foreground pointer-events-none absolute bottom-3 left-4 text-xs">
          镜头总数 {shots.length}
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
                void deleteShots([...selected]);
                setSelected(new Set());
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
                void deleteStoryBeat(episodeId, pendingBeatId);
                setPendingBeatId(undefined);
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

function gridColumns(visibleDefs: ColumnDef[]) {
  return `52px 64px 248px 248px 248px ${visibleDefs.map((column) => `${column.width}px`).join(" ")}`;
}

function BeatBlock({
  beat,
  shots,
  projectId,
  episodeId,
  selecting,
  selected,
  setSelected,
  visibleDefs,
  characters,
  scenes,
  loose,
  hideHeader,
  onDeleteBeat,
}: {
  beat: StoryBeat;
  shots: Shot[];
  projectId: string;
  episodeId: string;
  selecting: boolean;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  visibleDefs: ColumnDef[];
  characters: { id: string; name: string }[];
  scenes: { id: string; name: string }[];
  loose?: boolean;
  hideHeader?: boolean;
  onDeleteBeat?: () => void;
}) {
  const duration = shots.reduce((sum, shot) => sum + (Number(shot.durationSec) || 0), 0);

  return (
    <section>
      {hideHeader ? null : (
        <div className="bg-muted/70 flex min-w-max items-center gap-2 border-b px-3 py-2">
          <SquareStack className="text-muted-foreground size-3.5 shrink-0" />
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
          <Button size="sm" variant="outline" onClick={() => void addShot(episodeId, { beatId: beat.id })}>
            <Plus />
            添加镜头
          </Button>
        </div>
      ) : (
        shots.map((shot, index) => (
          <ShotRow
            key={shot.id}
            shot={shot}
            striped={index % 2 === 1}
            projectId={projectId}
            episodeId={episodeId}
            selecting={selecting}
            selected={selected}
            setSelected={setSelected}
            visibleDefs={visibleDefs}
            characters={characters}
            scenes={scenes}
            beatId={loose ? undefined : beat.id}
            showBelow={index === shots.length - 1}
          />
        ))
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
  visibleDefs,
  characters,
  scenes,
  beatId,
  showBelow,
}: {
  shot: Shot;
  striped: boolean;
  projectId: string;
  episodeId: string;
  selecting: boolean;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  visibleDefs: ColumnDef[];
  characters: { id: string; name: string }[];
  scenes: { id: string; name: string }[];
  beatId?: string;
  showBelow?: boolean;
}) {
  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="absolute z-10 size-6 rounded-full"
        style={{ left: 14, top: -12 }}
        onClick={() => void addShot(episodeId, { atOrder: shot.order, beatId: beatId ?? shot.beatId })}
        aria-label="在上方插入镜头"
      >
        <Plus />
      </Button>
      <div
        className={`grid items-stretch border-b ${striped ? "bg-muted/40" : "bg-background"}`}
        style={{ gridTemplateColumns: gridColumns(visibleDefs) }}
      >
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          {selecting ? (
            <Checkbox
              checked={selected.has(shot.id)}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(shot.id);
                else next.delete(shot.id);
                setSelected(next);
              }}
            />
          ) : (
            <GripVertical className="text-muted-foreground size-3.5" />
          )}
          <span className="text-muted-foreground text-xs">{shot.order}</span>
        </div>
        <div className="flex items-center justify-center">
          <Input
            value={shot.shotNumber}
            onChange={(event) => void patchShot(shot.id, { shotNumber: event.target.value })}
            className="h-8 w-10 border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center py-3">
          <EditableGenerationSlot
            projectId={projectId}
            slot={shot.firstFrame ?? emptySlot()}
            variant="frame"
            title={`镜头 ${shot.shotNumber} · 首帧`}
            onSave={(slot) => void setShotSlot(shot.id, "firstFrame", slot)}
          />
        </div>
        <div className="flex items-center py-3">
          <EditableGenerationSlot
            projectId={projectId}
            slot={shot.lastFrame ?? emptySlot()}
            variant="frame"
            title={`镜头 ${shot.shotNumber} · 尾帧`}
            onSave={(slot) => void setShotSlot(shot.id, "lastFrame", slot)}
          />
        </div>
        <div className="flex items-center py-3">
          <EditableGenerationSlot
            projectId={projectId}
            slot={shot.clip ?? emptySlot()}
            variant="clip"
            title={`镜头 ${shot.shotNumber} · 成片`}
            onSave={(slot) => void setShotSlot(shot.id, "clip", slot)}
          />
        </div>
        {visibleDefs.map((column) => (
          <div key={column.id} className="border-l">
            {column.id === "durationSec" ? (
              <PlainCell
                value={String(shot.durationSec || "")}
                onCommit={(value) =>
                  void patchShot(shot.id, {
                    durationSec: Math.max(0, Number(value) || 0),
                  })
                }
              />
            ) : column.id === "characters" ? (
              <div className="flex h-[124px] flex-col gap-1 overflow-auto p-2">
                {characters.map((character) => (
                  <label key={character.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={shot.characterIds.includes(character.id)}
                      onCheckedChange={(checked) => {
                        const ids = checked
                          ? [...shot.characterIds, character.id]
                          : shot.characterIds.filter((id) => id !== character.id);
                        void patchShot(shot.id, { characterIds: ids });
                      }}
                    />
                    {character.name}
                  </label>
                ))}
              </div>
            ) : column.id === "scene" ? (
              <div className="p-2">
                <Select
                  value={shot.sceneId ?? "none"}
                  onValueChange={(value) =>
                    void patchShot(shot.id, {
                      sceneId: value === "none" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="未选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未选择</SelectItem>
                    {scenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        {scene.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <PlainCell
                value={String(shot[column.id as keyof Shot] ?? "")}
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
          className="absolute z-10 size-6 rounded-full"
          style={{ left: 14, bottom: -12 }}
          onClick={() => void addShot(episodeId, { beatId })}
          aria-label="在末尾添加镜头"
        >
          <Plus />
        </Button>
      ) : null}
    </div>
  );
}
