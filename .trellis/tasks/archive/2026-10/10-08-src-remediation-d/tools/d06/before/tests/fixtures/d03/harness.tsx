import {createRoot} from "react-dom/client";
import {useState} from "react";
import Dexie from "dexie";
import JSZip from "jszip";
import {db} from "@/db/database";
import {createProject, createAudioMusicProject} from "@/db/projects";
import {addShot, setShotSlot} from "@/db/shots";
import {putMedia} from "@/db/media";
import {addAudioChapter, addAudioClip, addAudioSegment, addAudioTake, getAudioProjectSnapshot} from "@/db/audio";
import {prepareAudioGenerationJob} from "@/db/audioGeneration";
import {useProjectAudioJobs} from "@/components/audioMusic/shared";
import {addMusicWork} from "@/db/music";
import {beginAgentRun, finishAgentRun} from "@/db/agentRuns";
import {createChatThread} from "@/db/chat";
import {pauseForApproval, saveToolRound, startModelStep, transitionToolCall} from "@/db/agentTools";
import {updateGeneralAgentConfig} from "@/db/agentSettings";
import {exportProjectZip, importProjectZip, PackageError} from "@/lib/projectPackage";
import {PackageError as CodecPackageError} from "@/lib/packages/packageError";
import {exportAudioMix} from "@/lib/audio/exportMix";
import {loadAudioBuffer} from "@/lib/audio/buffers";
import {encodePcm16Wav} from "@/lib/audio/wav";
import {getAudioExportFreshness} from "@/lib/audio/fingerprint";
import {registerPendingDraft} from "@/lib/debouncedDraft";
import {useChatExecutionSession} from "@/components/agent/useChatExecutionSession";
import {retryFrozenChatRun, resolveChatRunAction} from "@/components/agent/chatExecutionFlows";
import type {ConnectorConfig} from "@/domain/types";

function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
await db.delete(); await db.open();
const connector: ConnectorConfig = {id: "d03-native", definitionId: "openai-compatible", name: "isolated", baseUrl: "https://no-provider.invalid/v1", apiKey: "fixture", updatedAt: new Date().toISOString()};
const gates = new Map<string, {promise: Promise<void>; release(): void}>();
const transport: Array<{model: string; aborted: boolean; status: string}> = [];
let session: ReturnType<typeof useChatExecutionSession>;
let changeThread: (id?: string) => void;
let routeId: string | undefined;
let observeProject: (id: string) => void;
function JobObserver({projectId}: {projectId: string}) {useProjectAudioJobs(projectId); return <span data-observed-project={projectId}/>;}
const tokens = new Map<string, NonNullable<ReturnType<ReturnType<typeof useChatExecutionSession>["acquire"]>>>();
let pending: Promise<void> | undefined;
function App() {
    const [id, setId] = useState<string>();
    const [observedProject, setObservedProject] = useState("");
    observeProject = setObservedProject;
    routeId = id;
    changeThread = setId;
    session = useChatExecutionSession(id);
    return <><output data-sending={session.sending} data-thread={id ?? "home"}/>{observedProject && <JobObserver projectId={observedProject}/>}</>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<App/>);
function hold(name: string) {let release!: () => void; const promise = new Promise<void>(resolve => {release = resolve;}); gates.set(name, {promise, release});}
function release(name: string) {gates.get(name)?.release(); gates.delete(name);}
async function wait(name: string) {await gates.get(name)?.promise;}
async function durableSnapshot() {
    return JSON.stringify(await Promise.all(db.tables.map(async table => [table.name, await Promise.all((await table.toArray()).map(async row => ({...row,
        ...(row.blob instanceof Blob ? {blob: [...new Uint8Array(await row.blob.arrayBuffer())]} : {})
    })))])));
}
const fixture = {
    transport, hold, release, wait,
    changeThread: (id?: string) => changeThread(id),
    observeProject: (id: string) => observeProject(id),
    state: () => ({threadId: routeId, sending: session.sending, locked: session.sendLockRef.current, aborted: session.abortRef.current?.signal.aborted}),
    acquire: (key: string) => {const token = session.acquire(); if (!token) return false; tokens.set(key, token); return true;},
    releaseToken: (key: string) => session.release(tokens.get(key)!),
    bind: (id: string) => {session.executionThreadRef.current = id;},
    startRetry: (runId: string) => {
        const token = session.acquire(); check(token, "retry not acquired");
        pending = retryFrozenChatRun({runId, activeThreadId: routeId, controller: token.controller, isThreadCurrent: id => routeId === id})
            .then(result => {check(result.ok, "retry compatibility failed");}).finally(() => session.release(token));
    },
    settle: async () => {await pending;},
    seedRetry: async () => {
        await db.connectors.put(connector);
        const thread = await createChatThread({connectorId: connector.id, model: "original-model"});
        const run = await beginAgentRun({threadId: thread.id, connector, model: "original-model", content: "frozen request"});
        await finishAgentRun(run.id, "failed", {content: "partial"}, "fixture failure");
        return {threadId: thread.id, runId: run.id};
    },
    approval: async () => {
        await updateGeneralAgentConfig({enabledSkillIds: ["workspace", "planning"]});
        const thread = await createChatThread();
        const run = await beginAgentRun({threadId: thread.id, connector, model: "original-model", content: "review"});
        await startModelStep(run.id, 8);
        await saveToolRound(run.id, "approval", [{id: "d03-approve", type: "function", function: {name: "workspace_overview", arguments: "{}"}}], [{title: "local", effect: "write", highRisk: false}]);
        const call = (await db.agentToolCalls.where("runId").equals(run.id).toArray())[0];
        await transitionToolCall(run.id, call.id, ["pending"], "awaiting_approval");
        await pauseForApproval(run.id);
        await db.connectors.delete(connector.id);
        let error = "";
        try {await resolveChatRunAction({runId: run.id, callId: call.id, action: "approve", activeThreadId: thread.id, controller: new AbortController(), isThreadCurrent: () => true});} catch (reason) {error = (reason as Error).message;}
        check(error.includes("决定已保存"), "missing credentials did not report saved decision");
        check((await db.agentToolCalls.get(call.id))?.status === "approved", "approval lost on connector failure");
        await resolveChatRunAction({runId: run.id, action: "cancel", activeThreadId: thread.id, controller: new AbortController(), isThreadCurrent: () => true});
        check((await db.agentRuns.get(run.id))?.status === "cancelled", "connector-free cancellation failed");
        return {approvalSaved: true, cancelWithoutConnector: true};
    },
    packages: async () => {
        check(PackageError === CodecPackageError, "public PackageError identity changed");
        const kinds = [];
        let importedHistoryProject = "";
        for (const kind of ["video", "audio", "music"] as const) {
            const project = kind === "video" ? await createProject("D03 video") : await createAudioMusicProject(`D03 ${kind}`, kind);
            const mediaId = `${project.id}-source`;
            const blob = new Blob([`${kind} original bytes`], {type: kind === "video" ? "image/png" : "audio/wav"});
            const media = {id: mediaId, projectId: project.id, filename: `${kind}.dat`, mimeType: blob.type, blob};
            if (kind === "video") {
                await putMedia(media);
                const episode = await db.episodes.where("projectId").equals(project.id).first(); check(episode, "missing video episode");
                const shot = await addShot(project.id, episode.id);
                await setShotSlot(shot.id, "firstFrame", {prompt: "native", referenceImageIds: [], referenceVideoIds: [], result: {mediaId, kind: "image"}});
            } else if (kind === "audio") {
                const initial = await getAudioProjectSnapshot(project.id);
                const segment = await addAudioSegment(project.id, {chapterId: initial.chapters[0].id, text: "voice", notes: "", order: 0});
                const take = await addAudioTake(project.id, {mediaId, segmentId: segment.id, name: "voice", source: "upload", durationSec: 1, sampleRate: 48000, channels: 1}, media);
                await addAudioClip(project.id, {chapterId: initial.chapters[0].id, trackId: initial.tracks[0].id, takeId: take.id, startSec: 0, trimStartSec: 0, trimEndSec: 1, gain: 1, fadeInSec: 0, fadeOutSec: 0});
                await addAudioChapter(project.id, {title: "second chapter", order: 1});
                const job = await prepareAudioGenerationJob(project.id, {intentId: "d03-history", input: {kind: "speech", text: "history", voice: "alloy", speed: 1}, connector: {id: "old", provider: "apimart", baseUrl: "https://no-provider.invalid/v1"}, source: {kind: "manual"}});
                await db.audioGenerationJobs.update(job.id, {status: "running", taskIds: ["native-task"]});
            } else await addMusicWork(project.id, {mediaId, title: "music", notes: "", favorite: false, lyrics: "", durationSec: 1, sampleRate: 48000, channels: 1, provenance: {provider: "apimart", model: "suno"}}, media);
            const zipBlob = await exportProjectZip(project.id);
            const zip = await JSZip.loadAsync(zipBlob);
            const entries = zip.file(/^media\//).filter(entry => !entry.dir);
            check(entries.length === 1 && await entries[0].async("string") === `${kind} original bytes`, "ZIP bytes changed");
            const imported = await importProjectZip(zipBlob);
            const records = await db.media.where("projectId").equals(imported.id).toArray();
            check(records.length === 1 && await records[0].blob.text() === `${kind} original bytes`, "import bytes changed");
            if (kind === "audio") {
                importedHistoryProject = imported.id;
                const importedJob = await db.audioGenerationJobs.where("projectId").equals(imported.id).first();
                check(importedJob?.dormant && importedJob.source.kind === "manual" && importedJob.connector.id === "imported" && importedJob.connector.baseUrl === "" && !importedJob.claim, "imported job retained live execution ownership");
                const audio = JSON.parse(await zip.file("audioProject.json")!.async("string"));
                // Valid remapped IDs, invalid relationship only detected by the in-transaction validator.
                const foreignChapter = audio.audioChapters.find((chapter: {id: string}) => chapter.id !== audio.audioSegments[0].chapterId);
                check(foreignChapter, "missing alternate chapter");
                audio.audioSegments[0].chapterId = foreignChapter.id;
                zip.file("audioProject.json", JSON.stringify(audio));
                const bad = await zip.generateAsync({type: "blob"});
                const before = await durableSnapshot();
                const original = db.audioClips.bulkAdd;
                let observedWrites = false;
                db.audioClips.bulkAdd = (async function (...args: Parameters<typeof original>) {
                    const result = await original.apply(db.audioClips, args);
                    const row = args[0][0];
                    const tx = Dexie.currentTransaction;
                    observedWrites = Boolean(tx && await tx.table("projects").get(row.projectId) && await tx.table("media").where("projectId").equals(row.projectId).count() && await tx.table("audioClips").get(row.id));
                    return result;
                }) as typeof original;
                let rejected = false;
                let validationError = "";
                try {await importProjectZip(bad);} catch (error) {rejected = error instanceof PackageError; validationError = (error as Error).message;} finally {db.audioClips.bulkAdd = original;}
                check(rejected && observedWrites && validationError.includes("配音版本不属于当前章节"), `audio late validator boundary not exercised: rejected=${rejected}, observed=${observedWrites}, error=${validationError}`);
                check(await durableSnapshot() === before, "invalid audio import did not fully roll back");
            }
            kinds.push(kind);
        }
        return {roundtrips: kinds, realZipBytes: true, lateAudioValidatorRollback: true, publicErrorIdentity: true, importedHistoryProject, dormantJobSanitized: true};
    },
    renderExport: async () => {
        const project = await createAudioMusicProject("native render", "audio");
        const snapshot = await getAudioProjectSnapshot(project.id);
        const chapter = snapshot.chapters[0];
        const pcm = new Float32Array(4800).fill(.2);
        const {blob} = encodePcm16Wav({sampleRate: 48000, numberOfChannels: 1, length: pcm.length, getChannelData: () => pcm});
        const mediaId = `${project.id}-pcm`;
        const take = await addAudioTake(project.id, {mediaId, name: "sine", source: "upload", durationSec: .1, sampleRate: 48000, channels: 1}, {id: mediaId, projectId: project.id, filename: "source.wav", mimeType: "audio/wav", blob});
        await addAudioClip(project.id, {chapterId: chapter.id, trackId: snapshot.tracks[0].id, takeId: take.id, startSec: 0, trimStartSec: 0, trimEndSec: .1, gain: 1, fadeInSec: 0, fadeOutSec: 0});
        let flushed = false;
        const unregister = registerPendingDraft(project.id, async () => {check(!Dexie.currentTransaction, "draft flush in transaction"); flushed = true;});
        try {
            const playbackBuffer = await loadAudioBuffer(mediaId);
            const result = await exportAudioMix({projectId: project.id, projectName: project.name, chapterId: chapter.id, scope: "chapter"});
            check(flushed && result.blob.size > 44, "native export failed");
            check(await loadAudioBuffer(mediaId) === playbackBuffer, "export did not share the playback cache");
            const row = await db.audioExports.where("projectId").equals(project.id).first();
            check(row && getAudioExportFreshness(row, await getAudioProjectSnapshot(project.id)) === "current", "native export evidence is stale");
            const saved = await db.media.get(row.mediaId);
            check(saved && saved.blob.size === result.blob.size, "native rendered WAV not saved");
            const header = new TextDecoder().decode((await result.blob.arrayBuffer()).slice(0, 4));
            check(header === "RIFF", "native export is not WAV");
            return {nativeDecodeRender: true, sharedPlaybackExportBuffer: true, savedWavBytes: result.blob.size};
        } finally {unregister();}
    },
};
declare global {interface Window {d03: typeof fixture}}
window.d03 = fixture;
