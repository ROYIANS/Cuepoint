/** Height of `.app-topbar` (44px) plus a small gap. Floating panels are portalled into stacking contexts
 *  below the top bar (z-index 30), so a panel that grows up to the window edge ends up hidden under it. */
export const APP_TOPBAR_CLEARANCE = 52;

export function popupCollisionPadding(edge = 16): { top: number; right: number; bottom: number; left: number } {
    return {top: APP_TOPBAR_CLEARANCE, right: edge, bottom: edge, left: edge};
}
