import {readBinaryBlob} from "../storage/binary";
import {binaryByteLength} from "../../domain/binary";
import type {ProductStore} from "../storage/types";
import {db as productDb} from "../../db/database";
import {ownedAudioRow} from "../../db/audioShared";
import type {MimoSpeechSettings} from "../../domain/audio";
import {mimoSpeechSettingsSchema} from "./input";
import {validateMimoReference} from "../ai/mimoSpeech";

export {validateMimoReference as validateMimoReferenceBlob} from "../ai/mimoSpeech";

/** Shared by preparation, repository validation and Agent review; never returns base64. */
export async function validateSpeechReference(projectId: string, input: {
    mimo?: MimoSpeechSettings
}, store?: ProductStore) {
    const db = store ?? productDb;
    if (!input.mimo) return undefined;
    const settings = mimoSpeechSettingsSchema.parse(input.mimo);
    if (settings.mode !== "clone") return undefined;
    const media = await ownedAudioRow(db.media, projectId, settings.referenceMediaId!);
    const inspect = async () => {
        const blob = media.blob instanceof Blob ? media.blob : await readBinaryBlob(media.blob);
        const mimeType = await validateMimoReference(blob);
        const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
        const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        return {
            mediaId: media.id,
            filename: media.filename,
            mimeType,
            size: binaryByteLength(media.blob),
            fingerprint,
            blob
        };
    };
    // Blob/WebCrypto promises must not close a caller's IndexedDB transaction.
    return db.waitFor(inspect());
}
