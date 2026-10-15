import type {ComponentProps} from "react";
import {cn} from "@/lib/utils";

/** Minimal switch: no dependency, keyboard toggles on Space/Enter like a native button. */
export function Switch({
                           checked,
                           onCheckedChange,
                           disabled,
                           className,
                           ...props
                       }: Omit<ComponentProps<"button">, "onChange" | "role"> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-slot="switch"
        data-state={checked ? "checked" : "unchecked"}
        onClick={() => onCheckedChange(!checked)}
        className={cn("settings-switch", className)}
        {...props}
    >
        <span className="settings-switch-thumb" aria-hidden/>
    </button>;
}
