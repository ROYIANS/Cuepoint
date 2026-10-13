import {Link} from "@tanstack/react-router";

/** Audio/music reuse their substantive left pane instead of adding another sidebar. */
export function ProjectWorkspaceNavigation({projectId, projectName, kind}: {
    projectId: string; projectName: string; kind: "audio" | "music";
}) {
    return <nav className="module-navigation-section shrink-0" aria-label="项目工作区">
        <p className="module-navigation-heading truncate" title={projectName}>{projectName}</p>
        <Link to="/projects" className="module-navigation-row">全部项目</Link>
        <Link to="/p/$projectId" params={{projectId}} activeOptions={{exact: true}}
              className="module-navigation-row" activeProps={{className: "bg-accent text-foreground font-medium"}}>
            {kind === "audio" ? "音频制作" : "音乐创作"}
        </Link>
        <Link to="/p/$projectId/memory" params={{projectId}} className="module-navigation-row"
              activeProps={{className: "bg-accent text-foreground font-medium"}}>记忆</Link>
    </nav>;
}
