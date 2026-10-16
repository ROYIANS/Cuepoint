import {useEffect, useRef, useState} from "react";
import {useProductQueryState} from "../../../platform/product/queries";
import {StorageError} from "../../../platform/storage/errors";
import {desktopMediaServices, DesktopMediaUncertainError} from "../../../platform/runtime/desktopMedia";
import {Button} from "../../../ui/button";
import type {DesktopMediaImport} from "../models/desktopMediaImport";
import {desktopMediaSelection, importDesktopMedia, inspectDesktopMediaImport, ownsDesktopMediaImport, pickDesktopMediaDirectory, revokeDesktopMediaCandidates, stopDesktopMediaImport, type DesktopMediaCandidates} from "../services/desktopMediaImport";
import "./desktopMediaImport.css";

function DesktopMediaImportProgress({record, currentFilename, allowStop = false}: {record: DesktopMediaImport; currentFilename?: string; allowStop?: boolean}) {
    const [stopping, setStopping] = useState(false);
    const active = ["accepted", "running", "stopping"].includes(record.status);
    const canStop = allowStop && active && ownsDesktopMediaImport(record.id, record.projectId);
    return <div className="desktop-media-progress" data-desktop-media-import={record.id}>
        <p>已导入 {record.receipts.length} / {record.selection.items.length} 个视频</p>
        {currentFilename && record.status === "running" && <p className="desktop-media-current">{currentFilename}</p>}
        {record.status === "stopping" || stopping && active ? <p>等待当前处理结束，不再开始下一项。</p> : null}
        {record.status === "stopped" && <p>已停止，保留已导入的素材。还有 {record.selection.items.length - record.receipts.length} 项未导入。</p>}
        {record.status === "failed" && <p role="alert">{record.error ?? "未能完成导入，已导入的素材仍然保留。"}</p>}
        {record.status === "unknown" && <p role="alert">未确认导入结果，已导入的素材已保留。</p>}
        {canStop && <Button size="sm" variant="outline" disabled={stopping || record.status === "stopping"} onClick={() => {
            if (stopping) return;
            setStopping(true); stopDesktopMediaImport(record.id, record.projectId);
        }}>停止</Button>}
    </div>;
}

/** Inline project-scoped import. Hiding/reopening never invents a new producer. */
export function DesktopMediaImportPanel({projectId}: {projectId: string}) {
    return <ProjectDesktopMediaImport key={projectId} projectId={projectId}/>;
}
function ProjectDesktopMediaImport({projectId}: {projectId: string}) {
    const available = Boolean(desktopMediaServices());
    const [candidates, setCandidates] = useState<DesktopMediaCandidates>();
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const [uncertainIntent, setUncertainIntent] = useState<{id: string; projectId: string}>();
    const [currentFilename, setCurrentFilename] = useState<string>();
    const [live, setLive] = useState<DesktopMediaImport>();
    const [checking, setChecking] = useState(false), [selecting, setSelecting] = useState(false), [scanStopping, setScanStopping] = useState(false);
    const uncertainGrant = useRef(false);
    const lock = useRef(false), controller = useRef<AbortController | undefined>(undefined), alive = useRef(true);
    const query = useProductQueryState(async tx => ({projectId, records: (await tx.desktopMediaImports.where("projectId").equals(projectId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))}), [projectId]);
    const records = query.value?.projectId === projectId ? query.value.records : [];
    const retained = records.find(row => ["accepted", "running", "stopping", "unknown"].includes(row.status)) ?? records[0];
    const record = live?.projectId === projectId && (!retained || live.id === retained.id && live.revision >= retained.revision) ? live : retained;
    const unresolved = Boolean(uncertainIntent) || !!record && ["accepted", "running", "stopping", "unknown"].includes(record.status);
    useEffect(() => {alive.current = true; return () => {alive.current = false; controller.current?.abort();};}, []);
    useEffect(() => () => {if (candidates && !lock.current && !uncertainGrant.current) void revokeDesktopMediaCandidates(candidates).catch(() => undefined);}, [candidates]);
    const selectDirectory = async () => {
        if (lock.current || unresolved || !query.value || query.error) return;
        lock.current = true; setBusy(true); setSelecting(true); setScanStopping(false); setError("");
        const next = new AbortController(); controller.current = next;
        try {
            if (candidates) await revokeDesktopMediaCandidates(candidates);
            const value = await pickDesktopMediaDirectory(projectId, next.signal);
            if (alive.current) {setCandidates(value); setSelected([]); setLive(undefined);}
        } catch (cause) {if (alive.current) setError(cause instanceof Error ? cause.message : "无法读取素材目录。");}
        finally {if (alive.current) {setBusy(false); setSelecting(false);} lock.current = false;}
    };
    const start = async () => {
        if (!candidates || lock.current || unresolved) return;
        lock.current = true; setBusy(true); setError("");
        const id = crypto.randomUUID(), next = new AbortController(); controller.current = next;
        try {
            const selection = desktopMediaSelection(candidates, selected, id);
            const saved = await importDesktopMedia({id, projectId, actor: {kind: "human"}, selection, signal: next.signal, onProgress: progress => {
                if (alive.current) {setLive(progress.record); setCurrentFilename(progress.currentFilename);}
            }});
            if (alive.current) {uncertainGrant.current = saved.status === "unknown"; setLive(saved); if (saved.status !== "unknown") {setCandidates(undefined); setSelected([]);}}
        } catch (cause) {if (alive.current) {
            if (cause instanceof DesktopMediaUncertainError || cause instanceof StorageError && cause.certainty === "unknown") {uncertainGrant.current = true; setUncertainIntent({id, projectId});}
            setError(cause instanceof Error ? cause.message : "导入未能完成，请核对已有记录。");
        }}
        finally {if (alive.current) {setBusy(false); setCurrentFilename(undefined);} lock.current = false;}
    };
    const inspect = async () => {
        const intent = uncertainIntent ?? record;
        if (!intent || checking) return;
        setChecking(true); setError("");
        try {const saved = await inspectDesktopMediaImport(intent.id, projectId); if (alive.current) {setLive(saved); setUncertainIntent(undefined);}}
        catch (cause) {if (alive.current) setError(cause instanceof Error ? cause.message : "无法读取导入结果。");}
        finally {if (alive.current) setChecking(false);}
    };
    return <section className="desktop-media-import" aria-label="本地文件夹视频导入">
        <div className="desktop-media-import-header"><div><h2>从文件夹导入视频</h2><p>选择视频后生成缩略图，原文件保持不变。</p></div>
            <Button variant="outline" disabled={!available || busy || unresolved || !query.value || Boolean(query.error)} onClick={() => void selectDirectory()}>{selecting ? "选择与读取目录…" : "导入文件夹"}</Button></div>
        {selecting && <Button size="sm" variant="outline" disabled={scanStopping} onClick={() => {
            if (scanStopping) return;
            setScanStopping(true); controller.current?.abort();
        }}>停止</Button>}
        {!available && <p className="material-muted">此功能需要 macOS 或 Windows 桌面版与桌面工作区。</p>}
        {available && !candidates && !record && <p className="material-muted">最多扫描 8 层目录</p>}
        {candidates && !unresolved && <>
            <p>{candidates.grant.label} · {candidates.entries.length} 个视频{candidates.scan.skipped > 0 ? ` · ${candidates.scan.skipped} 项未纳入列表` : ""}</p>
            {candidates.entries.length > 0 ? <><div className="desktop-media-candidates" role="group" aria-label="选择要导入的视频">
                {candidates.entries.map(entry => <label key={entry.entryId}><input type="checkbox" checked={selected.includes(entry.entryId)} disabled={busy || selected.length >= 64 && !selected.includes(entry.entryId)} onChange={event => setSelected(previous => event.target.checked ? [...previous, entry.entryId] : previous.filter(id => id !== entry.entryId))}/><span title={entry.relativeName}>{entry.displayName}</span><small>{(entry.byteLength / 1024 / 1024).toFixed(1)} MiB</small></label>)}
            </div><Button disabled={busy || !selected.length} onClick={() => void start()}>导入所选 {selected.length || ""} 个视频</Button></> : <p>此目录中没有符合范围的视频。</p>}
        </>}
        {uncertainIntent && <p role="alert">未确认这次导入是否已开始，请先核对，暂不能重新导入。</p>}
        {record && !selecting && (!candidates || unresolved || live?.id === record.id) && <DesktopMediaImportProgress key={record.id} record={record} currentFilename={currentFilename} allowStop/>}
        {unresolved && !busy && <div className="desktop-media-recovery"><p>请先核对这次导入。</p><Button variant="outline" size="sm" disabled={checking} onClick={() => void inspect()}>核对导入结果</Button></div>}
        {(error || query.error) && <p role="alert" className="material-error">{error || query.error?.message}</p>}
    </section>;
}
