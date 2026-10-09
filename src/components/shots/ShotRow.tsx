import {ShotTextField} from "./ShotTextField";
import type {TextDraftStatusChange} from "@/lib/useTextDraftRetention";
import {toast} from "sonner";
import {useCallback, type CSSProperties} from "react";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {ArrowDown, ArrowUp, ChevronDown, CopyPlus, GripVertical, Plus} from "lucide-react";
import {addShot, patchShot, setShotCharacterSelected, setShotSlot} from "@/db/shots";
import {SHOT_COLUMNS, type ColumnDef} from "@/domain/columns";
import {emptySlot} from "@/domain/slot";
import {normalizeShotStatus, SHOT_STATUS_LABELS, SHOT_STATUSES, type Character, type Scene, type Shot, type ShotColumnId, type ShotWorkspaceView, type GenerationSlot, type Id} from "@/domain/types";
import {cn} from "@/lib/utils";
import {EditableGenerationSlot} from "@/components/slots/GenerationSlotCard";
import {Still} from "@/components/studio/Still";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {DurationInput} from "./DurationInput";
import {useShotRowViewport} from "./ShotRowViewport";
import {gridColumns, TEXT_SHOT_FIELDS} from "./shotColumnFields";

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
        case "cameraAngle":
        case "cameraGear":
        case "category":
        case "emotion":
        case "focalLength":
        case "sceneCloseup":
        case "sound":
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
            <Still mediaId={mediaId} title={title} className="p-1.5 [&_span]:text-base"/>
        </div>
    );
}

const FLUSH_SELECT_TRIGGER =
    `${DESIGN_CELL_CHROME} w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 data-[size=default]:h-full dark:bg-transparent dark:hover:bg-transparent`;


export function ShotRow({
                     textPending,
                     onDraftStatus,
                     shot,
                     striped,
                     initiallyVisible,
                     projectId,
                     episodeId,
                     selecting,
                     selected,
                     onSelectedChange,
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
                     onEditRelations,
                     onSlotOpenChange,
                     unavailable,
                 }: {
    textPending?: boolean;
    onDraftStatus?: TextDraftStatusChange;
    shot: Shot;
    striped: boolean;
    initiallyVisible: boolean;
    projectId: string;
    episodeId: string;
    selecting: boolean;
    selected: boolean;
    onSelectedChange: (checked: boolean) => void;
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
    unavailable: boolean;
    onSlotOpenChange: (open: boolean) => void;
    onEditRelations: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({id: shot.id, disabled: selecting});
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : undefined,
        zIndex: isDragging ? 10 : undefined,
    };
    const {rowRef, nearViewport} = useShotRowViewport(initiallyVisible);
    const mountedRowRef = useCallback((element: HTMLDivElement | null) => {
        setNodeRef(element);
        rowRef(element);
    }, [setNodeRef, rowRef]);
    const renderContents = nearViewport || active || isDragging || textPending;
    const selectedScene = scenes.find((scene) => scene.id === shot.sceneId);
    const selectedCharacters = characters.filter((character) =>
        shot.characterIds.includes(character.id),
    );

    return (
        <div
            id={`shot-${shot.id}`}
            ref={mountedRowRef}
            style={{...style, height: 160}}
            tabIndex={renderContents ? undefined : 0}
            aria-label={renderContents ? undefined : `镜头 ${shot.shotNumber}`}
            data-shot-mounted={renderContents ? "true" : "false"}
            className={`group relative scroll-m-20 transition-shadow duration-300 ${
                active ? "z-10 overflow-visible" : ""
            }`}
            onMouseDown={onActivate}
            onFocusCapture={onActivate}
        >
            {renderContents ? <>
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
                    <Plus/>
                </Button>
                <div
                    className={cn(
                        "grid h-[160px] items-stretch border-b",
                        striped ? "bg-muted/40" : "bg-background",
                        active && "ring-2 ring-inset ring-brand",
                    )}
                    style={{gridTemplateColumns: gridColumns(workspaceView, visibleDefs)}}
                >
                    <div className={SHOT_LEFT_CONTROLS}>
                        {selecting ? (
                            <Checkbox
                                aria-label={`选择镜头 ${shot.shotNumber}`}
                                checked={selected}
                                onCheckedChange={(checked) => {
                                    onSelectedChange(checked === true);
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
                                    <ArrowUp/>
                                </Button>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground inline-flex size-6 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
                                    aria-label="拖拽调整镜头顺序"
                                    {...attributes}
                                    {...listeners}
                                >
                                    <GripVertical className="size-3.5"/>
                                </button>
                                <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label="下移镜头"
                                    disabled={!canMoveDown}
                                    onClick={() => onMove(1)}
                                >
                                    <ArrowDown/>
                                </Button>
                                <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label="复制镜头"
                                    onClick={onDuplicate}
                                >
                                    <CopyPlus/>
                                </Button>
                            </>
                        )}
                    </div>
                    <div className={cn(DESIGN_CELL_CHROME, "flex-col gap-2")}>
                        <ShotTextField shot={shot} field="shotNumber" onDraftStatus={onDraftStatus} unavailable={unavailable}
                            ariaLabel="镜号"
                            className="h-8 w-10 border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-1 text-xs"
                                aria-label={`镜头 ${shot.shotNumber} 道具与风格`}
                                onClick={onEditRelations}>设定</Button>
                    </div>
                    <div className={cn(DESIGN_CELL_CHROME, "border-l")}>
                        <Select
                            value={normalizeShotStatus(shot.status)}
                            onValueChange={(value) =>
                                void patchShot(shot.id, {status: normalizeShotStatus(value)})
                            }
                        >
                            <SelectTrigger
                                className="h-8 w-full border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent">
                                <SelectValue/>
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
                                    unavailable={unavailable}
                                    onEditorOpenChange={onSlotOpenChange}
                                    projectId={projectId}
                                    targetKey={JSON.stringify([projectId, "shot", shot.id, "firstFrame"])}
                                    slot={shot.firstFrame ?? emptySlot()}
                                    variant="frame"
                                    size="row"
                                    title={`镜头 ${shot.shotNumber} · 首帧`}
                                    onSave={(slot, baseline) => setShotSlot(shot.id, "firstFrame", slot, baseline)}
                                />
                            </div>
                            <div className={cn(DESIGN_CELL_CHROME, "w-full border-l")}>
                                <EditableGenerationSlot
                                    unavailable={unavailable}
                                    onEditorOpenChange={onSlotOpenChange}
                                    projectId={projectId}
                                    targetKey={JSON.stringify([projectId, "shot", shot.id, "lastFrame"])}
                                    slot={shot.lastFrame ?? emptySlot()}
                                    variant="frame"
                                    size="row"
                                    title={`镜头 ${shot.shotNumber} · 尾帧`}
                                    onSave={(slot, baseline) => setShotSlot(shot.id, "lastFrame", slot, baseline)}
                                />
                            </div>
                            <div className={cn(DESIGN_CELL_CHROME, "w-full border-l")}>
                                <EditableGenerationSlot
                                    unavailable={unavailable}
                                    onEditorOpenChange={onSlotOpenChange}
                                    projectId={projectId}
                                    targetKey={JSON.stringify([projectId, "shot", shot.id, "clip"])}
                                    slot={shot.clip ?? emptySlot()}
                                    variant="clip"
                                    size="row"
                                    title={`镜头 ${shot.shotNumber} · 成片`}
                                    onSave={(slot, baseline) => setShotSlot(shot.id, "clip", slot, baseline)}
                                />
                            </div>
                            <div className="flex h-full min-w-0 border-l">
                                <ShotTextField shot={shot} field="content" onDraftStatus={onDraftStatus} unavailable={unavailable}
                                    multiline rows={4} placeholder="镜头内容" ariaLabel="镜头内容"
                                    containerClassName="flex h-full w-full min-w-0 flex-col px-2 py-3"
                                    className="h-full w-full min-w-0 resize-none border-0 bg-transparent shadow-none field-sizing-fixed"/>
                            </div>
                        </>
                    ) : visibleDefs.map(({id}) => (
                        <div key={id} className="flex h-full min-h-0 min-w-0 border-l">
                            {id === "durationSec" ? (
                                <div className={cn(DESIGN_CELL_CHROME, "w-full")}>
                                    <DurationInput projectId={projectId} shotId={shot.id} value={shot.durationSec}/>
                                </div>
                            ) : id === "characters" ? (
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
                                            <ChevronDown className="size-4 opacity-50"/>
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
                                                        void patchShot(shot.id, {characterIds: []});
                                                    }}
                                                >
                                                    清除
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator/>
                                                {characters.map((character) => {
                                                    const selectedChar = shot.characterIds.includes(character.id);
                                                    return (
                                                        <DropdownMenuCheckboxItem
                                                            key={character.id}
                                                            checked={selectedChar}
                                                            onSelect={(event) => event.preventDefault()}
                                                            onCheckedChange={(checked) => {
                                                                onActivate();
                                                                void setShotCharacterSelected(shot.id, character.id, checked === true)
                                                                    .catch(() => toast.error("保存角色失败，请重试"));
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
                            ) : id === "scene" ? (
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
                                <ShotTextField shot={shot} field={TEXT_SHOT_FIELDS[id]} onDraftStatus={onDraftStatus} unavailable={unavailable}
                                    multiline rows={4} placeholder={columnPlaceholder(id)} ariaLabel={columnPlaceholder(id)}
                                    containerClassName="flex h-full w-full min-w-0 flex-col px-2 py-3"
                                    className="h-full w-full min-w-0 resize-none border-0 bg-transparent shadow-none field-sizing-fixed"/>
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
                        onClick={() => void addShot(projectId, episodeId, {beatId})}
                        aria-label="在末尾添加镜头"
                    >
                        <Plus/>
                    </Button>
                ) : null}
            </> : null}
        </div>
    );
}
