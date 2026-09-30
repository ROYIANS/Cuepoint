import {useState} from "react";
import {createRoot} from "react-dom/client";
import {useLiveQuery} from "dexie-react-hooks";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/repo";
import {patchMusicDraft} from "@/db/music";
import type {MusicDraft} from "@/domain/music";
import {MusicCreation} from "@/components/music/MusicCreation";
import {flushPendingDrafts} from "@/lib/debouncedDraft";

const project = await createAudioMusicProject("C02 legacy repair", "music");
const row = (await db.musicDrafts.where("projectId").equals(project.id).toArray())[0];
const historical: MusicDraft = {...row, settings: {engine: "suno", version: "v6", custom: false, instrumental: false, prompt: "historical description", title: "history", style: "", negativeTags: "", durationSec: 30.5}};
await db.musicDrafts.put(historical);
let changeSwitching: ((value: boolean) => void) | undefined;
function Surface() {
    const record = useLiveQuery(() => db.musicDrafts.get(row.id), [row.id]);
    const [switching, setSwitching] = useState(false);
    changeSwitching = setSwitching;
    if (!record) return <p>loading fixture</p>;
    return <MusicCreation key={record.id} record={record} switching={switching} changeVariant={() => {throw new Error("fixture never switches variants");}} connectorId="" setConnectorId={() => undefined} onSubmitted={() => {throw new Error("fixture never submits paid generation");}} onSubmittingChange={() => undefined}/>;
}
createRoot(document.getElementById("root")!).render(<Surface/>);
const state = () => db.musicDrafts.get(row.id);
async function externalWrite() {
    const current = await state();
    if (!current || current.settings.engine !== "suno") throw new Error("fixture state invalid");
    const settings = {...current.settings, prompt: "remote writer", durationSec: 60};
    await patchMusicDraft(project.id, row.id, current.revision, {settings});
}
async function flush() {
    try {await flushPendingDrafts(project.id); return {ok: true};}
    catch (error) {return {ok: false, message: error instanceof Error ? error.message : String(error)};}
}
declare global {interface Window {c02: {state: typeof state; externalWrite: typeof externalWrite; flush: typeof flush; switching: (value: boolean) => void}}}
window.c02 = {state, externalWrite, flush, switching: value => changeSwitching?.(value)};
