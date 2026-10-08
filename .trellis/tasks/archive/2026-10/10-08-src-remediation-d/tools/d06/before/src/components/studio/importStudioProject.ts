import {toast} from "sonner";
import {importProjectZip, PackageError} from "@/lib/projectPackage";
import type {Project} from "@/domain/types";

export async function importStudioProject(file: File): Promise<Project | undefined> {
    try {
        return await importProjectZip(file);
    } catch (err) {
        toast.error(err instanceof PackageError ? err.message : "导入失败");
        return undefined;
    }
}
