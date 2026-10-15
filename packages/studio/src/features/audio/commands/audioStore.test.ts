import Dexie from "dexie";
import {expect, it} from "vitest";
import {createBrowserProductStore} from "../../../platform/storage/browser";
import {PRODUCT_SCHEMA, TABLE_NAMES} from "../../../platform/storage/schema";
import {db as fixedStore} from "../../../platform/product/store";
import {AUDIO_TRANSACTION_TABLES} from "../../../platform/product/scopes";
import {createAudioMusicProject} from "../../projects/commands/projects";
import {addAudioSegment, patchAudioSegment} from "./audio";
import {getAudioProjectSnapshot} from "../queries/snapshot";

it("keeps explicit audio readers/writers and a late ledger failure in one independent transaction", async () => {
    const database = new Dexie("audio-owner-independent");
    database.version(1).stores(Object.fromEntries(TABLE_NAMES.map(name => {
        const definition = PRODUCT_SCHEMA[name];
        return [name, [definition.keyPath, ...definition.indexes.map(index => (index.unique ? "&" : "") + index.name)].join(",")];
    })));
    await database.open();
    const store = createBrowserProductStore(database);
    try {
        const project = await createAudioMusicProject("explicit owner", "audio", undefined, store);
        const snapshot = await getAudioProjectSnapshot(project.id, store);
        expect(await fixedStore.projects.get(project.id)).toBeUndefined();
        let mutationReached = false;
        await expect(store.transaction("rw", [...AUDIO_TRANSACTION_TABLES, "agentToolCalls"], async tx => {
            const segment = await addAudioSegment(project.id, {chapterId: snapshot.chapters[0].id, text: "uncommitted", notes: "", order: 0}, tx);
            const read = await getAudioProjectSnapshot(project.id, tx);
            expect(read.segments.map(row => row.id)).toContain(segment.id);
            await patchAudioSegment(project.id, segment.id, segment.revision, {text: "latest"}, tx);
            expect((await getAudioProjectSnapshot(project.id, tx)).segments[0].text).toBe("latest");
            mutationReached = true;
            await tx.agentToolCalls.add({id: "duplicate"} as never);
            await tx.agentToolCalls.add({id: "duplicate"} as never);
        })).rejects.toThrow();
        expect(mutationReached).toBe(true);
        expect((await getAudioProjectSnapshot(project.id, store)).segments).toEqual([]);
        expect(await store.agentToolCalls.count()).toBe(0);
        expect(await fixedStore.audioSegments.count()).toBe(0);
        const saved = await addAudioSegment(project.id, {chapterId: snapshot.chapters[0].id, text: "committed", notes: "", order: 0}, store);
        expect((await getAudioProjectSnapshot(project.id, store)).segments.map(row => row.id)).toEqual([saved.id]);
        const observations: string[][] = [];
        let initial!: () => void, updated!: () => void;
        const first = new Promise<void>(resolve => {initial = resolve;});
        const changed = new Promise<void>(resolve => {updated = resolve;});
        const stop = store.observe(tx => getAudioProjectSnapshot(project.id, tx), {
            next(value) {
                observations.push(value.segments.map(row => row.text));
                if (value.segments.some(row => row.text === "observed")) updated();
                else initial();
            },
            error(error) {throw new Error("Audio snapshot observation failed", {cause: error});},
        });
        try {
            await first;
            await addAudioSegment(project.id, {chapterId: snapshot.chapters[0].id, text: "observed", notes: "", order: 1}, store);
            await changed;
            expect(observations[0]).toEqual(["committed"]);
            expect(observations.at(-1)).toEqual(["committed", "observed"]);
            expect(await fixedStore.audioSegments.count()).toBe(0);
        } finally {stop();}
    } finally {
        await database.delete();
    }
});
