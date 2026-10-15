import {createFileRoute, Outlet, useNavigate} from "@tanstack/react-router";
import {StudioShell} from "../layout/StudioShell";
import {importStudioProject} from "../workflows/importStudioProject";
import {pickZipFile} from "../../features/library/services/library";

export const Route = createFileRoute("/_studio")({
    component: StudioLayout,
});

function StudioLayout() {
    const navigate = useNavigate();

    return (
        <StudioShell
            onImport={() => {
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
            <Outlet/>
        </StudioShell>
    );
}
