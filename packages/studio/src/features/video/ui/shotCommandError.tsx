import {createContext, useContext} from "react";
import {toast} from "sonner";

/** Region-level sink for failed shot edits so a persistent failure stays visible beside the list, not only in a toast. */
export const ShotCommandErrorContext = createContext<((error: unknown, fallback?: string) => void) | undefined>(undefined);

export function useShotCommandError(): (error: unknown, fallback?: string) => void {
    const report = useContext(ShotCommandErrorContext);
    return typeof report === "function" ? report : ((error, fallback = "保存失败，请重试") => {
        toast.error(error instanceof Error ? error.message : fallback);
    });
}
