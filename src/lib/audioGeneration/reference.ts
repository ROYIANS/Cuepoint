import Dexie from "dexie";
import { db } from "@/db/database";
import { ownedAudioRow } from "@/db/audioShared";
import type { MimoSpeechSettings } from "@/domain/audio";
import { mimoSpeechSettingsSchema } from "./input";
import { validateMimoReference } from "@/lib/ai/mimoSpeech";
export { MIMO_REFERENCE_ENCODED_LIMIT, validateMimoReference as validateMimoReferenceBlob } from "@/lib/ai/mimoSpeech";

/** Shared by preparation, repository validation and Agent review; never returns base64. */
export async function validateSpeechReference(projectId: string, input: { mimo?: MimoSpeechSettings }) {
  if (!input.mimo) return undefined;
  const settings = mimoSpeechSettingsSchema.parse(input.mimo);
  if (settings.mode !== "clone") return undefined;
  const media = await ownedAudioRow(db.media, projectId, settings.referenceMediaId!);
  const inspect = async () => {
    const mimeType = await validateMimoReference(media.blob);
    const digest = await crypto.subtle.digest("SHA-256", await media.blob.arrayBuffer());
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return { mediaId: media.id, filename: media.filename, mimeType, size: media.blob.size, fingerprint, blob: media.blob };
  };
  // Blob/WebCrypto promises must not close a caller's IndexedDB transaction.
  return Dexie.currentTransaction ? Dexie.waitFor(inspect()) : inspect();
}
