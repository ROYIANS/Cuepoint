import {toast} from "sonner";
import {isPublishedSaveError} from "./runtimeSave";

/** One exit for project-backup failures: published-save problems are warnings, anything else is a short failure with the reason. */
export function reportBackupFailure(error: unknown): void {
    if (isPublishedSaveError(error)) toast.warning(error.message);
    else toast.error(error instanceof Error ? `备份失败：${error.message}` : "备份失败，请重试");
}
