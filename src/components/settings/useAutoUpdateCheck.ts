import {useEffect} from "react";
import {dueForAutoCheck, readAutoCheckUpdates, readLastUpdateCheckAt} from "./settingsStore";
import {useUpdateCheck} from "./useUpdateCheck";

/** Off by default. When enabled, one silent check per app start, at most once every 24 hours. */
export function useAutoUpdateCheck() {
    const {runCheck} = useUpdateCheck();
    useEffect(() => {
        let live = true;
        const timer = window.setTimeout(() => {
            void (async () => {
                const enabled = await readAutoCheckUpdates().catch(() => false);
                if (!live || !enabled) return;
                const lastCheck = await readLastUpdateCheckAt().catch(() => undefined);
                if (!live || !dueForAutoCheck(lastCheck, Date.now())) return;
                await runCheck(true);
            })();
        }, 3000);
        return () => {live = false;window.clearTimeout(timer);};
    }, [runCheck]);
}
