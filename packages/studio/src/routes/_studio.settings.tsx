import {createFileRoute, useNavigate} from "@tanstack/react-router";
import {SettingsPage} from "../components/settings/SettingsPage";
import {isSettingsSectionId, type SettingsSectionId} from "../components/settings/settingsModel";

export const Route = createFileRoute("/_studio/settings")({
    validateSearch: (search: Record<string, unknown>): { section?: SettingsSectionId } =>
        isSettingsSectionId(search.section) ? {section: search.section} : {},
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
