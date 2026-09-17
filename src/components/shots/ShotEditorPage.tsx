import { useLiveQuery } from "dexie-react-hooks";
import {
  CheckSquare,
  ChevronDown,
  Columns3,
  GripVertical,
  Hash,
  Plus,
  Settings2,
  Type,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { db } from "@/db/database";
import {
  addShot,
  deleteShots,
  patchShot,
  setShotSlot,
  setVisibleColumns,
  updateProject,
} from "@/db/repo";
import { SHOT_COLUMNS, normalizeVisibleColumns } from "@/domain/columns";
import { emptySlot } from "@/domain/slot";
import type { Shot, ShotColumnId } from "@/domain/types";
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

export function ShotEditorPage({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const shots =
    useLiveQuery(
      () => db.shots.where("projectId").equals(projectId).sortBy("order"),
      [projectId],
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

  const totalDuration = useMemo(
    () => shots.reduce((sum, shot) => sum + (Number(shot.durationSec) || 0), 0),
    [shots],
  );

  if (!project) {
    return <div className="text-muted-foreground p-8 text-sm">加载分镜…</div>;
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
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => void addShot(projectId)}>添加镜头</DropdownMenuItem>
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
                gridTemplateColumns: `52px 64px 248px 248px ${visibleDefs
                  .map((column) => `${column.width}px`)
                  .join(" ")}`,
              }}
            >
              {["顺序", "镜号", "画面", "参考", ...visibleDefs.map((column) => column.label)].map(
                (label) => (
                  <div key={label} className="px-3 py-2.5">
                    {label}
                  </div>
                ),
              )}
            </div>

            {shots.length === 0 ? (
              <div className="text-muted-foreground flex h-52 flex-col items-center justify-center text-sm">
                还没有镜头，点击「新建」添加第一条
              </div>
            ) : null}

            {shots.map((shot, index) => (
              <div key={shot.id} className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="absolute z-10 size-6 rounded-full"
                  style={{ left: 14, top: -12 }}
                  onClick={() => void addShot(projectId, shot.order)}
                  aria-label="在上方插入镜头"
                >
                  <Plus />
                </Button>
                <div
                  className={`grid items-stretch border-b ${index % 2 === 1 ? "bg-muted/40" : "bg-background"}`}
                  style={{
                    gridTemplateColumns: `52px 64px 248px 248px ${visibleDefs
                      .map((column) => `${column.width}px`)
                      .join(" ")}`,
                  }}
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
                      onChange={(event) =>
                        void patchShot(shot.id, { shotNumber: event.target.value })
                      }
                      className="h-8 w-10 border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex items-center py-3">
                    <EditableGenerationSlot
                      projectId={projectId}
                      slot={shot.frame ?? emptySlot()}
                      variant="frame"
                      title={`镜头 ${shot.shotNumber} · 画面`}
                      onSave={(slot) => void setShotSlot(shot.id, "frame", slot)}
                    />
                  </div>
                  <div className="flex items-center py-3">
                    <EditableGenerationSlot
                      projectId={projectId}
                      slot={shot.reference ?? emptySlot()}
                      variant="reference"
                      title={`镜头 ${shot.shotNumber} · 参考`}
                      onSave={(slot) => void setShotSlot(shot.id, "reference", slot)}
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
                {index === shots.length - 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="absolute z-10 size-6 rounded-full"
                    style={{ left: 14, bottom: -12 }}
                    onClick={() => void addShot(projectId)}
                    aria-label="在末尾添加镜头"
                  >
                    <Plus />
                  </Button>
                ) : null}
              </div>
            ))}
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
    </div>
  );
}
