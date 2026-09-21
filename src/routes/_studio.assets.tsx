import { createFileRoute } from "@tanstack/react-router";
import { MaterialLibraryPage, type MaterialLibrarySearch } from "@/components/studio/MaterialLibraryPage";

export const Route = createFileRoute("/_studio/assets")({
  validateSearch: (value: Record<string, unknown>): MaterialLibrarySearch => ({
    ...(typeof value.ip === "string" && value.ip ? { ip: value.ip } : {}),
    ...(typeof value.project === "string" && value.project ? { project: value.project } : {}),
    ...(value.scope === "global" || value.scope === "all" || value.scope === "shared" ? { scope: value.scope } : {}),
    ...(value.view === "media" || value.view === "settings" ? { view: value.view } : {}),
  }),
  component: MaterialRoute,
});
function MaterialRoute() { return <MaterialLibraryPage search={Route.useSearch()} />; }
