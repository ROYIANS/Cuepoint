import {createRoot} from "react-dom/client";
import {useMemo, useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import {db} from "@/db/database";
import {createAudioMusicProject, renameProject} from "@/db/projects";
import {TextDraftField} from "@/components/drafts/TextDraftField";
import {useDebouncedDraft} from "@/lib/debouncedDraft";
import {DraftStatus} from "@/components/ui/draft-status";
import type {Project} from "@/domain/types";

const shape = new URLSearchParams(window.location.search).get("shape") === "memo" ? "memo" : "primitive";
await db.open();
const project = await createAudioMusicProject("Initial", "audio");
let release!: () => void;
const completion = new Promise<void>(resolve => {release = resolve;});
let previousInitial: unknown;
let seenInitial = false;
const host = {
    db, project, shape, release, writes: 0, writerFinished: false, observed: "", renders: 0,
    parentRenders: 0, memoIdentityChanges: 0, memoRendersWithSameIdentity: 0,
    rerender: () => {}, initialKind: "", status: "", draft: "",
};
declare global {interface Window {e07DraftRebase: typeof host}}
window.e07DraftRebase = host;

async function persistName(value: string) {
    // Real durable write completes before the controlled completion gate.
    await renameProject(project.id, value);
    host.writes++;
    await completion;
    host.writerFinished = true;
}
function MemoDraft({current}: {current: Project}) {
    const initialValue = useMemo(() => ({name: current.name}), [current.name]);
    if (seenInitial) {
        if (Object.is(previousInitial, initialValue)) host.memoRendersWithSameIdentity++;
        else host.memoIdentityChanges++;
    }
    previousInitial = initialValue;
    seenInitial = true;
    const {draft, setDraft, status, error, retry, useLatest} = useDebouncedDraft({
        initialValue, scope: project.id, draftKey: "memo-name", persist: value => persistName(value.name),
    });
    host.renders++;
    host.initialKind = typeof initialValue;
    host.status = status;
    host.draft = draft.name;
    return <><input aria-label="Draft name" value={draft.name} onChange={event => setDraft({name: event.target.value})}/>
        <DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest}/></>;
}
function App() {
    const [render, setRender] = useState(0);
    host.rerender = () => setRender(value => value + 1);
    host.parentRenders++;
    const current = useLiveQuery(() => db.projects.get(project.id), []);
    host.observed = current?.name ?? "";
    if (shape === "primitive" && current) host.initialKind = typeof current.name;
    if (!current) return <p>Loading</p>;
    return <main><section data-editor>{shape === "primitive"
        ? <TextDraftField projectId={project.id} draftKey="name" value={current.name} persist={persistName} ariaLabel="Draft name"/>
        : <MemoDraft current={current}/>}</section><output data-db>{current.name}</output><output data-render>{render}</output></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
