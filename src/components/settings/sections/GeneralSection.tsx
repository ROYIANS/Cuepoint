import {useEffect, useRef, useState} from "react";
import {useProductQueryState} from "@/lib/storage/hooks";
import {Switch} from "@/components/ui/switch";
import {SettingsGroup, SettingsRow} from "../SettingsCard";
import {readSettings, writeAutoCheckUpdates} from "../settingsStore";

function formatMoment(at: number | undefined): string {
    if (at === undefined) return "尚未检查";
    return new Date(at).toLocaleString("zh-CN", {dateStyle: "medium", timeStyle: "short"});
}

export function GeneralSection({visibleRowIds}: { visibleRowIds?: string[] }) {
    const {value: settings, error: readError} = useProductQueryState(tx => readSettings(tx));
    const [pending, setPending] = useState<boolean>();
    const [error, setError] = useState<string>();
    const saving = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function toggle(checked: boolean) {
        if (saving.current) return;
        saving.current = true;
        setPending(checked);
        setError(undefined);
        try {
            await writeAutoCheckUpdates(checked);
        } catch {
            if (mounted.current) setError("偏好未能保存，请重试。");
        } finally {
            saving.current = false;
            if (mounted.current) setPending(undefined);
        }
    }

    return <>
        <SettingsGroup title="更新偏好">
            {(!visibleRowIds || visibleRowIds.includes("auto-check")) && <SettingsRow
                title="启动时自动检查更新"
                description="开启后每天最多检查一次新版本。默认关闭，小光点不会主动联网检查更新。"
                control={<Switch checked={pending ?? settings?.autoCheck ?? false}
                                 disabled={!settings && !readError || pending !== undefined}
                                 aria-label="启动时自动检查更新" onCheckedChange={checked => void toggle(checked)}/>}
            />}
            {(!visibleRowIds || visibleRowIds.includes("last-check")) && <SettingsRow
                title="上次检查时间"
                description={settings ? formatMoment(settings.lastCheck) : readError ? "尚未检查" : "正在读取…"}
            />}
        </SettingsGroup>
        {error ? <p role="alert" className="mt-3 text-sm">{error}</p> : null}
        {readError ? <p role="status"
                        className="mt-3 text-sm">{settings ? "暂时无法读取偏好，正在显示上次读取的设置。" : "暂时无法读取偏好，当前使用默认值。"}</p> : null}
    </>;
}
