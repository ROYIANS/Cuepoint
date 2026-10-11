import {createFileRoute, Outlet, useNavigate, useRouterState} from "@tanstack/react-router";
import {StudioShell} from "@/components/studio/StudioShell";
import {importStudioProject} from "@/components/studio/importStudioProject";
import {pickZipFile} from "@/lib/library";
import {usesSqliteProductStorage} from "@/lib/productStorage";
import {WorkspaceCapabilityState} from "@/components/workspace/WorkspaceCapabilityState";

export const Route = createFileRoute("/_studio")({
    component: StudioLayout,
});

function StudioLayout() {
    const navigate = useNavigate();
    const sqlite = usesSqliteProductStorage();
    const pathname = useRouterState({select: state => state.location.pathname});
    const available = pathname === "/projects" || pathname === "/assets" || pathname === "/about" || pathname === "/settings";

    return (
        <StudioShell
            onImport={sqlite ? undefined : () => {
                void (async () => {
                    const file = await pickZipFile();
                    if (!file) return;
                    const project = await importStudioProject(file);
                    if (project) {
                        await navigate({to: "/p/$projectId", params: {projectId: project.id}});
                    }
                })();
            }}
        >
            {sqlite && !available ? <WorkspaceCapabilityState/> : <Outlet/>}
        </StudioShell>
    );
}
