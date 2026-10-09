import {createRoot} from "react-dom/client";
import {useState} from "react";
import {createRootRoute, createRoute, createRouter, RouterProvider} from "@tanstack/react-router";
import {promoteLegacyMaterial} from "@/db/materials";
import {Toaster} from "sonner";
import {db} from "@/db/database";
import {createAudioMusicProject} from "@/db/projects";
import {AudioWorkspacePage} from "@/components/audio/AudioWorkspacePage";
import {MusicWorkspacePage} from "@/components/music/MusicWorkspacePage";
import {defaultMusicSettings} from "@/domain/music";
import "@/styles.css";

let seedPhase = "db.open";
const {audio, music} = await (async () => {
const at = "2026-10-09T00:00:00.000Z";
await db.open();
const audio = await createAudioMusicProject("Offline audio story", "audio");
const music = await createAudioMusicProject("Offline music collection", "music");
const chapter = (await db.audioChapters.where("projectId").equals(audio.id).toArray())[0];
const track = (await db.audioTracks.where("projectId").equals(audio.id).toArray())[0];
const row = (id: string, projectId = audio.id) => ({id, projectId, revision: 1, createdAt: at, updatedAt: at});
// Valid local PCM WAV, deterministic and generated in the fixture. No network/permission.
const sampleRate = 8000, seconds = 4, samples = sampleRate * seconds;
const wav = new ArrayBuffer(44 + samples * 2), view = new DataView(wav);
const text = (offset: number, value: string) => {for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));};
text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVE"); text(12, "fmt ");
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
text(36, "data"); view.setUint32(40, samples * 2, true);
for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(i * 2 * Math.PI * 220 / sampleRate) * 2400), true);
const blob = new Blob([wav], {type: "audio/wav"});
await db.media.bulkPut([{id: "e03-audio-media", projectId: audio.id, mimeType: "audio/wav", filename: "story.wav", blob}, {id: "e03-music-media", projectId: music.id, mimeType: "audio/wav", filename: "music.wav", blob}]);
await promoteLegacyMaterial("media", "e03-audio-media", {kind: "global"});
await db.audioChapters.update(chapter.id, {title: "第一章 · 海边来信", createdAt: at, updatedAt: at});
await db.audioChapters.put({...row("e03-chapter-two"), title: "第二章 · 回声", order: 1});
await db.audioSpeakers.put({...row("e03-speaker"), name: "旁白", voice: "alloy", speed: 1});
await db.audioSegments.bulkPut([
    {...row("e03-segment-1"), chapterId: chapter.id, speakerId: "e03-speaker", order: 0, text: "清晨，海风把一封信送到了窗前。", notes: "轻声讲述", selectedTakeId: "e03-take-tts"},
    {...row("e03-segment-2"), chapterId: chapter.id, order: 1, text: "她推开窗，听见远处有人呼唤。", notes: ""},
]);
const metadata = {durationSec: seconds, sampleRate, channels: 1};
await db.audioTakes.bulkPut((['tts', 'recording', 'upload', 'library'] as const).map((source, index) => ({...row(`e03-take-${source}`), ...metadata, mediaId: "e03-audio-media", name: ["旁白 · 生成版本", "录音来源", "上传来源", "素材库来源"][index], source, ...(source === 'tts' ? {segmentId: "e03-segment-1", textSnapshot: "清晨，海风把一封信送到了窗前。"} : {})})));
await db.audioClips.put({...row("e03-clip"), chapterId: chapter.id, trackId: track.id, takeId: "e03-take-tts", startSec: 0, trimStartSec: 0, trimEndSec: seconds, gain: 1, fadeInSec: 0, fadeOutSec: 0});
await db.audioExports.put({...row("e03-export"), chapterId: chapter.id, chapterTitle: "第一章 · 海边来信", fingerprint: "fixture-export", format: "wav", mediaId: "e03-audio-media", durationSec: seconds});
const draft = (await db.musicDrafts.where("projectId").equals(music.id).toArray())[0];
const settings = {...defaultMusicSettings(), title: "海风序曲", prompt: "Warm piano and soft strings by the sea"};
await db.musicDrafts.update(draft.id, {settings, createdAt: at, updatedAt: at});
await db.musicDrafts.put({...row("e03-flow-draft", music.id), settings: {engine: "flowmusic", title: "回声", soundPrompt: "Gentle acoustic melody", lyrics: "海风送来远方的问候"}});
await db.musicWorks.bulkPut([0, 1].map(index => ({...row(`e03-work-${index}`, music.id), ...metadata, mediaId: "e03-music-media", title: index ? "暮色回声" : "海风序曲", notes: "温柔的钢琴与弦乐", lyrics: "海风送来远方的问候\n我们在此刻相遇", favorite: !index, settings})));
seedPhase = "audioGenerationJobs.put: global unique intentId";
for (const projectId of [audio.id, music.id]) await db.audioGenerationJobs.put({...row(`e03-job-${projectId}`, projectId), intentId: new URLSearchParams(location.search).has("duplicateIntent") ? "offline-history" : `offline-history-${projectId}`, input: projectId === audio.id ? {kind: "speech", text: "离线历史", voice: "alloy", speed: 1} : {kind: "music", settings}, connector: {id: "offline", provider: "apimart", baseUrl: "https://offline.invalid"}, source: {kind: "manual"}, status: "failed", taskIds: [], results: [], error: "保留的历史任务", dormant: true});

return {audio, music};
})().catch((error: unknown) => {
    const details = error instanceof Error ? {name: error.name, message: error.message, stack: error.stack} : {name: "UnknownSeedError", message: String(error)};
    Object.assign(window, {e03BootstrapError: {phase: seedPhase, ...details}});
    throw new Error(`E03 seed failed: ${JSON.stringify({phase: seedPhase, ...details})}`);
});

let switchPage: (kind: "audio" | "music") => void;
function Harness() {
    const [kind, setKind] = useState<"audio" | "music">("audio");
    switchPage = setKind;
    return <><div style={{height: "100dvh"}}>{kind === "audio" ? <AudioWorkspacePage projectId={audio.id}/> : <MusicWorkspacePage projectId={music.id}/>}</div><Toaster/></>;
}
Object.assign(window, {e03: {db, show: (kind: "audio" | "music") => switchPage(kind), ids: {audio: audio.id, music: music.id}}});
const root = createRootRoute();
const route = createRoute({getParentRoute: () => root, path: "/tests/fixtures/e03/", component: Harness});
const router = createRouter({routeTree: root.addChildren([route])});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
