/** Feature panels own target/drafts; the app coordinates exact committed selections. */
export type DetailPanelRequest<T> = {id: string; target: T};
export type DetailPanelOutcome =
    | {requestId: string; status: "presented"}
    | {requestId: string; status: "refused"; reason: "guard" | "busy"};
export type DetailPanelClose = {requestId: string; reason: "close" | "return" | "replaced"};
export type DetailPanelCloseRequest = {id: string; requestId: string; reason: "return"};
