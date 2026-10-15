import {SettingsGroup, SettingsRow} from "../SettingsCard";

export function AppearanceSection({visibleRowIds}: { visibleRowIds?: string[] }) {
    return <SettingsGroup title="显示与语言">
        {(!visibleRowIds || visibleRowIds.includes("theme")) &&
            <SettingsRow title="主题" description="深色。当前版本只提供深色主题。"
                         control={<span className="settings-value">深色</span>}/>}
        {(!visibleRowIds || visibleRowIds.includes("language")) &&
            <SettingsRow title="界面语言" description="简体中文。当前版本只提供简体中文。"
                         control={<span className="settings-value">简体中文</span>}/>}
    </SettingsGroup>;
}
