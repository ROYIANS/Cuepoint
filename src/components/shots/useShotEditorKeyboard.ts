import {useEffect, useRef} from "react";
import {isFormFieldTarget} from "@/lib/formFieldFocus";
import {stepActiveShotId} from "@/lib/shotKeyboard";

interface ShotKeyboardInput {
    unavailable: boolean;
    visibleShotIds: string[];
    activeShotId: string | undefined;
    hasSelection: boolean;

    onSelectAll(): void;

    onActivate(id: string | undefined): void;

    onToggleSelected(id: string): void;

    onReorder(id: string, offset: -1 | 1): void;

    onAdd(): void;

    onDelete(): void;
}

export function useShotEditorKeyboard(input: ShotKeyboardInput) {
    const latest = useRef(input);
    latest.current = input;
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.defaultPrevented || isFormFieldTarget(event.target)) return;
            const ctx = latest.current;
            if (ctx.unavailable) return;
            const meta = event.metaKey || event.ctrlKey;
            const key = event.key;

            if (meta && (key === "a" || key === "A")) {
                event.preventDefault();
                event.stopPropagation();
                ctx.onSelectAll();
                return;
            }

            if (event.altKey && (key === "ArrowUp" || key === "ArrowDown")) {
                const shotId = ctx.activeShotId;
                if (!shotId) return;
                event.preventDefault();
                event.stopPropagation();
                ctx.onReorder(shotId, key === "ArrowUp" ? -1 : 1);
                return;
            }

            if (meta || event.altKey) return;

            if (key === "j" || key === "ArrowDown" || key === "k" || key === "ArrowUp") {
                event.preventDefault();
                event.stopPropagation();
                const direction: -1 | 1 = key === "j" || key === "ArrowDown" ? 1 : -1;
                const next = stepActiveShotId(ctx.visibleShotIds, ctx.activeShotId, direction);
                ctx.onActivate(next);
                return;
            }

            if (key === " " || key === "x" || key === "X") {
                const shotId = ctx.activeShotId;
                if (!shotId || !ctx.visibleShotIds.includes(shotId)) return;
                event.preventDefault();
                event.stopPropagation();
                ctx.onToggleSelected(shotId);
                return;
            }

            if (key === "n" || key === "N") {
                event.preventDefault();
                event.stopPropagation();
                ctx.onAdd();
                return;
            }

            if (key === "Backspace") {
                if (!ctx.hasSelection) return;
                event.preventDefault();
                event.stopPropagation();
                ctx.onDelete();
            }
        }

        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, []);

}
