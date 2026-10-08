import {createContext, useContext} from "react";

/** The project shell keeps mounted drafts readable after a project/episode disappears. */
export const WorkspaceUnavailableContext = createContext(false);
export function useWorkspaceUnavailable() {
    return useContext(WorkspaceUnavailableContext);
}
