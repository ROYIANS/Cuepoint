export interface TimelineKeyEvent {
  key: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}
export interface TimelineShortcutState {
  focused: boolean;
  /** The caller excludes text inputs, open menus/dialogs, pending edits and active drags. */
  blocked: boolean;
  hasSelection: boolean;
  canSplit: boolean;
  canUndo: boolean;
  canRedo: boolean;
}
export type TimelineShortcut = "play" | "undo" | "redo" | "remove" | "split" | "duplicate";

/** Only handles keys inside the focused timeline; never takes browser/text shortcuts globally. */
export function resolveTimelineShortcut(event: TimelineKeyEvent, state: TimelineShortcutState): TimelineShortcut | undefined {
  if (!state.focused || state.blocked || event.repeat || event.isComposing || event.defaultPrevented || event.altKey) return;
  if (event.metaKey && event.ctrlKey) return;
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey) {
    if (key === "z") return event.shiftKey ? state.canRedo ? "redo" : undefined : state.canUndo ? "undo" : undefined;
    if (event.shiftKey) return;
    if (key === "y") return state.canRedo ? "redo" : undefined;
    if (key === "d") return state.hasSelection ? "duplicate" : undefined;
    return;
  }
  if (event.shiftKey) return;
  if (key === " " || event.code === "Space") return "play";
  if (key === "delete" || key === "backspace") return state.hasSelection ? "remove" : undefined;
  if (key === "s") return state.hasSelection && state.canSplit ? "split" : undefined;
}
