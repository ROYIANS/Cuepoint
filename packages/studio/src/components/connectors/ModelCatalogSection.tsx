import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {toast} from "sonner";
import {showError} from "../errors/showError";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";
import {Button} from "../ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "../ui/dropdown-menu";
import {Ellipsis} from "../ui/icons";
import {getModelCatalog, subscribeModelCatalog} from "../../lib/ai/modelCatalog/store";
import {clearSyncedCatalog, getCatalogSelection, syncModelCatalog} from "../../lib/ai/modelCatalog/sync";
import {ModelCatalogPicker} from "./ModelCatalogPicker";
import {ModelPriceTable} from "./ModelPriceTable";

type LastResult = { ok: boolean; message: string };

function formatTime(iso: string | undefined): string {
    const date = iso ? new Date(iso) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("zh-CN") : "未知时间";
}

export function ModelCatalogSection() {
    const catalog = useSyncExternalStore(subscribeModelCatalog, getModelCatalog);
    const [syncing, setSyncing] = useState(false);
    const [last, setLast] = useState<LastResult>();
    const [picking, setPicking] = useState(false);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [pickCount, setPickCount] = useState<number>();
    const controller = useRef<AbortController | undefined>(undefined);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            controller.current?.abort();
        };
    }, []);
    // Not a product query: the selection is read once in an effect and kept in state.
    useEffect(() => {
        if (picking) return;
        let current = true;
        void getCatalogSelection().then(selection => {
            if (current) setPickCount(selection.modelKeys.length);
        });
        return () => {
            current = false;
        };
    }, [picking]);

    async function sync() {
        if (controller.current) {
            controller.current.abort();
            return;
        }
        const own = new AbortController();
        controller.current = own;
        setSyncing(true);
        try {
            const result = await syncModelCatalog(await getCatalogSelection(), {signal: own.signal});
            if (!mounted.current) return;
            if (result.ok) {
                const message = `已同步 ${result.count} 个模型${result.truncated ? "（超出本机存储上限，已省略最早发布的部分）" : ""}`;
                setLast({ok: true, message});
                toast.success(message);
            } else if (result.code === "cancelled") {
                setLast({ok: false, message: result.message});
            } else {
                setLast({ok: false, message: result.message});
                showError({
                    title: "同步模型目录失败",
                    cause: new Error(result.message),
                    actionName: "sync-model-catalog",
                    detail: result.message
                });
            }
        } catch (error) {
            if (mounted.current) {
                setLast({ok: false, message: "同步失败"});
                showError({title: "同步模型目录失败", cause: error, actionName: "sync-model-catalog"});
            }
        } finally {
            if (controller.current === own) controller.current = undefined;
            if (mounted.current) setSyncing(false);
        }
    }

    async function restore() {
        setConfirmRestore(false);
        if (await clearSyncedCatalog()) toast.success("已恢复为内置数据");
        else showError({
            title: "恢复内置数据失败",
            cause: new Error("delete failed"),
            actionName: "restore-model-catalog",
            detail: "无法清除已同步的数据，当前目录保持不变"
        });
    }

    return (
        <div className="mt-6">
            <section aria-labelledby="model-catalog-sync" className="rounded-lg border p-5">
                <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1 basis-60">
                        <h2 id="model-catalog-sync" className="text-base font-semibold">模型目录</h2>
                        <p className="mt-1 text-sm" data-testid="catalog-source">
                            {!catalog ? "正在加载目录…" : catalog.source === "synced"
                                ? `已同步 · ${formatTime(catalog.syncedAt)}`
                                : `内置基线 · 包版本 ${catalog.packageVersion ?? "未知"}`}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {catalog ? `当前目录共 ${catalog.entries.length} 个模型` : ""}
                            {pickCount ? `；手选 ${pickCount} 个` : ""}
                        </p>
                        {last && <p role="status" className={`mt-1 text-sm ${last.ok ? "" : "text-destructive"}`}>
                            上次同步：{last.ok ? "成功" : "未完成"}，{last.message}
                        </p>}
                        <p className="text-muted-foreground mt-3 text-xs">同步将从 models.dev
                            获取公开模型目录，不会发送任何本机数据。</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" disabled={syncing || !catalog}
                                onClick={() => setPicking(true)}>选择模型</Button>
                        <Button variant={syncing ? "outline" : "brand"} size="sm"
                                onClick={() => void sync()}>{syncing ? "取消" : "立即同步"}</Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="更多操作"><Ellipsis
                                    className="size-4" aria-hidden/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled={syncing || catalog?.source !== "synced"}
                                                  onSelect={() => setConfirmRestore(true)}>恢复为内置数据</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </section>
            {catalog && <ModelPriceTable entries={catalog.entries}/>}
            {picking && catalog && <ModelCatalogPicker entries={catalog.entries} onClose={() => setPicking(false)}/>}
            <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>恢复为内置数据？</AlertDialogTitle>
                        <AlertDialogDescription>将删除已同步的模型目录，回到应用内置的基线数据。你的手选清单会保留，之后可重新同步。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void restore()}>恢复</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
