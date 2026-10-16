import {createFileRoute, useNavigate} from "@tanstack/react-router";
import {SettingsPage} from "../../features/settings/ui/SettingsPage";
import {normalizeSettingsSection, type SettingsSectionId} from "../../features/settings/ui/settingsModel";

export const Route = createFileRoute("/_studio/settings")({
    validateSearch: (search: Record<string, unknown>): { section?: SettingsSectionId } =>
        normalizeSettingsSection(search.section) ? {section: normalizeSettingsSection(search.section)} : {},
    component: SettingsRoute,
});

function SettingsRoute() {
    const {section} = Route.useSearch();
    const navigate = useNavigate();
    return <SettingsPage
        section={section}
        onSectionChange={next => void navigate({to: "/settings", search: {section: next}, replace: true})}
    />;
}
