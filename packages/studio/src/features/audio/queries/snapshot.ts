import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from "../../../platform/product/store";
import type {AudioProjectSnapshot} from "../models/audio";
import {assertAudioProject} from "../commands/ownership";
import {AUDIO_TRANSACTION_TABLES} from "../../../platform/product/scopes";

export async function getAudioProjectSnapshot(projectId: string, store?: ProductStore): Promise<AudioProjectSnapshot> {
    const db = store ?? productDb;
    return db.transaction("r", AUDIO_TRANSACTION_TABLES, async (db) => {
        await assertAudioProject(projectId, "audio", db);
        const [chapters, speakers, segments, takes, tracks, clips, exports] = await Promise.all([
            db.audioChapters.where("projectId").equals(projectId).sortBy("order"), db.audioSpeakers.where("projectId").equals(projectId).toArray(),
            db.audioSegments.where("projectId").equals(projectId).sortBy("order"), db.audioTakes.where("projectId").equals(projectId).toArray(),
            db.audioTracks.where("projectId").equals(projectId).sortBy("order"), db.audioClips.where("projectId").equals(projectId).toArray(), db.audioExports.where("projectId").equals(projectId).toArray(),
        ]);
        return {chapters, speakers, segments, takes, tracks, clips, exports};
    });
}
