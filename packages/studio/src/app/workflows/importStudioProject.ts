import {toast} from "sonner";
import {importProjectZip, PackageError} from "./packages/projectPackage";
import type {Project} from "../../features/projects/models/project";

export async function importStudioProject(file: File): Promise<Project | undefined> {
    try {
        return await importProjectZip(file);
    } catch (err) {
        toast.error(err instanceof PackageError ? err.message : "导入失败");
        return undefined;
    }
}
