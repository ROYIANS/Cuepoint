import {useCallback, useRef, useState} from "react";
import {ModuleLayout, useModuleNavigation} from "@/components/layout/ModuleLayout";
import {PageContent, PageHeader} from "@/components/layout/PageLayout";
import {Search} from "@/components/ui/icons";
import {ConnectorsSection} from "@/components/studio/ConnectorsPage";
import {AppearanceSection} from "./sections/AppearanceSection";
import {GeneralSection} from "./sections/GeneralSection";
import {StorageSection} from "./sections/StorageSection";
import {UpdateSection} from "./sections/UpdateSection";
import {filterSettings, isSettingsSectionId, SETTINGS_SECTIONS, type SettingsSectionId} from "./settingsModel";

export function SettingsPage({section, onSectionChange}: {section?: string; onSectionChange: (id: SettingsSectionId) => void}) {
    const [query, setQuery] = useState("");
    const [editingConnection, setEditingConnection] = useState(false);
    const editingConnectionRef = useRef(false);
    const onEditorOpenChange = useCallback((open: boolean) => {
        // Lock before the credential dialog mounts: autofill can use the search
        // handler from the preceding render during that same browser event.
        editingConnectionRef.current = open;
        setEditingConnection(open);
    }, []);
    const navigation = useModuleNavigation();
    const active: SettingsSectionId = isSettingsSectionId(section) ? section : "general";

    const filtered = filterSettings(SETTINGS_SECTIONS, query);
    const visible = filtered.some(item => item.id === active) ? active : filtered[0]?.id;
    const visibleSection = filtered.find(item => item.id === visible);
    const visibleRowIds = query.trim() ? visibleSection?.rows.map(row => row.id) : undefined;

    return <ModuleLayout className="settings-layout" navigationLabel="设置导航" navigation={<>
        <p className="settings-navigation-title">设置</p>
        <label className="settings-search">
            <Search aria-hidden/>
            <input
                type="search"
                name="cuepoint-settings-filter"
                autoComplete="off"
                disabled={editingConnection}
                value={query}
                onChange={event => {
                    if (!editingConnectionRef.current) setQuery(event.target.value);
                }}
                placeholder="搜索设置"
                aria-label="搜索设置"
            />
        </label>
        <div className="module-nav-group settings-navigation-items">
            {filtered.map(item => {
                const Icon = SETTINGS_SECTIONS.find(section => section.id === item.id)!.icon;
                return <button
                    key={item.id}
                    type="button"
                    className="module-nav-item"
                    disabled={editingConnection}
                    aria-current={item.id === visible ? "page" : undefined}
                    onClick={() => {
                        if (editingConnectionRef.current) return;
                        onSectionChange(item.id);
                        if (navigation.narrow) navigation.setOpen(false);
                    }}
                ><Icon weight={item.id === visible ? "fill" : "regular"} aria-hidden/>{item.title}</button>;
            })}
        </div>
        {filtered.length === 0
            ? <p className="settings-search-empty">没有匹配的设置项</p>
            : null}
    </>}>
        <PageContent mode="detail" className="settings-content">
            <PageHeader title={visibleSection?.title ?? "搜索设置"}/>
            <div className="settings-body">
                {visible === "general" ? <GeneralSection visibleRowIds={visibleRowIds}/> : null}
                {visible === "appearance" ? <AppearanceSection visibleRowIds={visibleRowIds}/> : null}
                {visible === "connections" ? <ConnectorsSection visibleRowIds={visibleRowIds} onEditorOpenChange={onEditorOpenChange}/> : null}
                {visible === "storage" ? <StorageSection visibleRowIds={visibleRowIds}/> : null}
                {visible === "update" ? <UpdateSection visibleRowIds={visibleRowIds}/> : null}
                {!visible ? <div role="status" className="settings-empty-state">
                    <Search aria-hidden/>
                    <p>没有匹配的设置项</p>
                    <span>请尝试其他关键词。</span>
                </div> : null}
            </div>
        </PageContent>
    </ModuleLayout>;
}
