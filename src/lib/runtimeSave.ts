import {isTauriRuntime} from "@/lib/runtimeIdentity";

export type SaveResult = "saved" | "canceled";

const NATIVE_FILENAME_BYTES = 240;

function utf8Prefix(value: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    let result = "", bytes = 0;
    for (const character of value) {
        const size = encoder.encode(character).byteLength;
        if (bytes + size > maxBytes) break;
        result += character;
        bytes += size;
    }
    return result;
}

/** A native dialog suggestion is display metadata, never a renderer-owned path. */
export function nativeSaveFilename(filename: string): string {
    const safe = Array.from(filename, (character) => {
        const code = character.codePointAt(0)!;
        return code >= 0xd800 && code <= 0xdfff ? "�" : character;
    }).join("").normalize("NFC")
        .replace(/[\\/:*?"<>|\p{Cc}]+/gu, "-")
        .replace(/\s+/gu, " ").trim().replace(/[. ]+$/u, "");
    // Preserve a usable format suffix when the authored title needs shortening.
    // Compound tar suffixes are one format; arbitrary dotted titles stay titles.
    const suffix = /(?:\.tar\.(?:gz|bz2|xz|zst)|\.[a-z0-9]{1,16})$/iu.exec(safe)?.[0] ?? "";
    const title = (suffix ? safe.slice(0, -suffix.length) : safe).replace(/^[. ]+/u, "").trim();
    const basename = /^[. -]*$/u.test(title) ? "导出" : title;
    const budget = NATIVE_FILENAME_BYTES - new TextEncoder().encode(suffix).byteLength;
    const bounded = utf8Prefix(basename, budget).replace(/[. ]+$/u, "") || "导出";
    return bounded + suffix;
}

/** Distinguish a saved file with a finalization warning from an unpublished failure. */
export function isPublishedSaveError(error: unknown): error is Error & { published: true } {
    return error instanceof Error && "published" in error && error.published === true;
}

/** Export bytes through the host without changing the command that produced them. */
export async function downloadBlob(blob: Blob, filename: string, signal?: AbortSignal): Promise<SaveResult> {
    signal?.throwIfAborted();
    if (isTauriRuntime()) {
        const {saveNativeBlob} = await import("@/lib/nativeSystemServices");
        return saveNativeBlob(blob, nativeSaveFilename(filename), signal);
    }

    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        return "saved";
    } finally {
        URL.revokeObjectURL(url);
    }
}
