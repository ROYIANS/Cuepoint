import type {Id} from "../../../platform/identity";

export const STUDIO_LIBRARY_ID = "studio" as const;

export function isStudioLibrary(ownerId: Id): boolean {
    return ownerId === STUDIO_LIBRARY_ID;
}
