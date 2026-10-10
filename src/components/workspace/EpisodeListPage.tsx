import {useNavigate} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {Plus} from "lucide-react";
import {CoverCard, LibraryGrid} from "@/components/studio/CoverCard";
import {PageContent, PageHeader, PageState} from "@/components/layout/PageLayout";
import {Button} from "@/components/ui/button";
import {Field} from "@/components/ui/field";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Input} from "@/components/ui/input";
import {DraftStatus} from "@/components/ui/draft-status";
import {db} from "@/db/database";
import {addEpisode, deleteEpisode, reorderEpisodes, restoreEpisode} from "@/db/episodes";
import {updateSeriesLogline} from "@/db/projects";
import {episodeLabel, normalizeSeriesStory, type Shot} from "@/domain/types";
import {useDebouncedDraft} from "@/lib/debouncedDraft";
import {formatUpdatedAt} from "@/lib/format";
import {useUndo} from "@/lib/undo";

function coverOfEpisode(shots: Shot[], episodeId: string): string | undefined {
    return shots
        .filter((shot) => shot.episodeId === episodeId)
        .sort((left, right) => left.order - right.order)
        .find((shot) => shot.firstFrame.result?.mediaId)?.firstFrame.result?.mediaId;
}

export function EpisodeListPage({projectId}: { projectId: string }) {
    return <EpisodeList key={projectId} projectId={projectId}/>;
}

function EpisodeList({projectId}: { projectId: string }) {
    const navigate = useNavigate();
    const activeRef = useRef(true);
    useEffect(() => {
        activeRef.current = true;
        return () => {
            activeRef.current = false;
        };
    }, []);
    const writingRef = useRef(false);
    const [pending, setPending] = useState<"add" | "move" | "delete">();
    const [deleteError, setDeleteError] = useState("");
    const project = useLiveQuery(
        async () => (await db.projects.get(projectId)) ?? null,
        [projectId],
    );
    const loadedEpisodes =
        useLiveQuery(
            () => db.episodes.where("projectId").equals(projectId).sortBy("order"),
            [projectId],
        );
    const episodes = loadedEpisodes ?? [];
    const shots =
        useLiveQuery(() => db.shots.where("projectId").equals(projectId).toArray(), [projectId]) ?? [];
    const [deleteId, setDeleteId] = useState<string>();
    const {registerUndo} = useUndo();

    if (project === undefined) {
        return <PageContent><PageState kind="loading" title="正在读取集列表…"/></PageContent>;
    }
    if (project === null) {
        return <PageContent><PageState kind="missing" title="找不到这个项目"/></PageContent>;
    }

    const canDelete = episodes.length > 1;
    let pendingLabel = "删除中…";
    if (pending === "add") pendingLabel = "创建中…";
    else if (pending === "move") pendingLabel = "调整顺序中…";

    async function moveEpisode(index: number, offset: -1 | 1) {
        if (writingRef.current) return;
        const target = index + offset;
        if (target < 0 || target >= episodes.length) return;
        const previous = episodes.map((episode) => episode.id);
        const next = [...previous];
        [next[index], next[target]] = [next[target], next[index]];
        writingRef.current = true;
        setPending("move");
        try {
            await reorderEpisodes(projectId, next);
            if (activeRef.current) registerUndo({
                label: "已调整分集顺序",
                restore: () => reorderEpisodes(projectId, previous),
            });
        } catch (error) {
            if (activeRef.current) toast.error(error instanceof Error && error.message ? error.message : "调整顺序失败，请重试");
        } finally {
            writingRef.current = false;
            if (activeRef.current) setPending(undefined);
        }
    }

    async function createEpisode() {
        if (writingRef.current) return;
        writingRef.current = true;
        setPending("add");
        try {
            await addEpisode(projectId);
        } catch (error) {
            if (activeRef.current) toast.error(error instanceof Error && error.message ? error.message : "创建失败，请重试");
        } finally {
            writingRef.current = false;
            if (activeRef.current) setPending(undefined);
        }
    }

    async function removeEpisode() {
        if (!deleteId || writingRef.current) return;
        const id = deleteId;
        writingRef.current = true;
        setPending("delete");
        setDeleteError("");
        try {
            const snapshot = await deleteEpisode(id);
            if (activeRef.current) {
                if (snapshot) registerUndo({
                    label: "已删除分集",
                    restore: () => restoreEpisode(snapshot),
                });
                setDeleteId((current) => current === id ? undefined : current);
            }
        } catch (error) {
            if (activeRef.current) setDeleteError(error instanceof Error && error.message ? error.message : "删除失败，请重试");
        } finally {
            writingRef.current = false;
            if (activeRef.current) setPending(undefined);
        }
    }

    return (
        <div className="app-scroll h-full overflow-auto">
            <PageContent mode="collection">
                <PageHeader title="集" description="按集整理故事与分镜，各集共用项目世界。"
                            actions={<Button disabled={Boolean(pending)} onClick={() => void createEpisode()}><Plus aria-hidden/>{pending === "add" ? "创建中…" : `新建第 ${episodes.length + 1} 集`}</Button>}/>

                <SeriesLoglineEditor
                    key={project.id}
                    projectId={project.id}
                    initialValue={normalizeSeriesStory(project.story).logline}
                />

                {pending && <p role="status" className="text-muted-foreground mt-4 text-sm">{pendingLabel}</p>}
                <div className="mt-6">
                    {loadedEpisodes === undefined ? <PageState kind="loading" title="正在读取集列表…"/> : !episodes.length ?
                        <PageState title="暂无分集" description="新建第一集，开始整理故事与分镜。"/> :
                    <LibraryGrid>
                        {episodes.map((episode, index) => (
                            <CoverCard
                                key={episode.id}
                                title={episodeLabel(episode)}
                                subtitle={`更新 ${formatUpdatedAt(episode.updatedAt)}`}
                                mediaId={coverOfEpisode(shots, episode.id)}
                                onOpen={() =>
                                    void navigate({
                                        to: "/p/$projectId/e/$episodeId",
                                        params: {projectId, episodeId: episode.id},
                                    })
                                }
                                actions={[
                                    ...(index > 0
                                        ? [{label: "上移", onSelect: () => void moveEpisode(index, -1)}]
                                        : []),
                                    ...(index < episodes.length - 1
                                        ? [{label: "下移", onSelect: () => void moveEpisode(index, 1)}]
                                        : []),
                                    ...(canDelete
                                        ? [{
                                            label: "删除",
                                            tone: "danger" as const,
                                            onSelect: () => {
                                                if (writingRef.current) return;
                                                setDeleteError("");
                                                setDeleteId(episode.id);
                                            },
                                        }]
                                        : []),
                                ]}
                            />
                        ))}
                    </LibraryGrid>}
                </div>
            </PageContent>

            <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => {
                if (!open && !writingRef.current) setDeleteId(undefined);
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除这一集</AlertDialogTitle>
                        <AlertDialogDescription>
                            这一集的故事和镜头会一起删掉。不能删掉最后一集。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && <p role="alert" className="text-destructive text-sm">{deleteError}</p>}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending === "delete"}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={pending === "delete"}
                            onClick={(event) => {
                                event.preventDefault();
                                void removeEpisode();
                            }}
                        >
                            {pending === "delete" ? "删除中…" : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function SeriesLoglineEditor({
                                 projectId,
                                 initialValue,
                             }: {
    projectId: string;
    initialValue: string;
}) {
    const {draft, setDraft, status, error, retry, useLatest} = useDebouncedDraft({
        draftKey: `project:${projectId}:logline`,
        scope: projectId,
        initialValue,
        persist: (value, baseline) => updateSeriesLogline(projectId, value, baseline),
    });
    return (
        <>
            <div className="mt-6 mb-2 flex flex-wrap items-end justify-between gap-4">
                <DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest}/>
            </div>
            <Field label="整部戏一句话">
            <Input
                value={draft}
                placeholder="这部戏，用一句话说完（可选）"
                onChange={(event) => setDraft(event.target.value)}
            />
            </Field>
        </>
    );
}
