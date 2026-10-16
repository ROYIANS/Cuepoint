import {db as productDb} from "../../../../platform/product/store";
import type {ProductStore} from "../../../../platform/storage/types";
import type {InstalledSkillsSnapshot} from "../models/installedSkill";
import {readSkillCatalogueRecord, SKILL_CATALOGUE_KEY} from "../runtime/records";
import {collectSkillRevision, parseInstalledSkillsSnapshot, putSkillSetting, readSkillRetentions} from "./retention";

export interface SkillHistoryRelease {
    readonly releasedRevisions: number;
    readonly affectedRuns: number;
    /** Revisions still pinned by a running or approval-waiting run. */
    readonly keptRevisions: number;
}

/**
 * Releases retained revisions that no installed skill uses any more. Finished
 * runs lose their pin: the revision is dropped from their frozen snapshot, so a
 * later retry of that run no longer offers the skill. Runs that are still
 * active keep their revisions. This is the remedy for the retained-revision cap
 * when the user wants to keep chat history.
 */
export async function releaseHistoricalSkillRevisions(store: ProductStore = productDb): Promise<SkillHistoryRelease> {
    return store.transaction("rw", ["deviceSettings", "agentRuns"], async tx => {
        const catalogue = await readSkillCatalogueRecord(tx);
        const retentions = await readSkillRetentions(catalogue, tx);
        const historical = new Set([...retentions.values()].filter(retention => retention.currentReferences === 0).map(retention => retention.revision));
        if (!historical.size) return {releasedRevisions: 0, affectedRuns: 0, keptRevisions: 0};
        const runs = await tx.agentRuns.filter(run => run.installedSkills !== undefined).toArray();
        const pinned = new Map<string, InstalledSkillsSnapshot>();
        const protectedRevisions = new Set<string>();
        for (const run of runs) {
            const snapshot = parseInstalledSkillsSnapshot(run.installedSkills);
            pinned.set(run.id, snapshot);
            if (run.status === "running" || run.status === "waiting_approval") {
                for (const entry of snapshot.entries) protectedRevisions.add(entry.revision);
            }
        }
        const released = new Set([...historical].filter(revision => !protectedRevisions.has(revision)));
        let affectedRuns = 0;
        const counts = new Map<string, number>();
        for (const run of runs) {
            const snapshot = pinned.get(run.id)!;
            const kept = snapshot.entries.filter(entry => !released.has(entry.revision));
            if (kept.length === snapshot.entries.length) continue;
            for (const revision of new Set(snapshot.entries.map(entry => entry.revision))) {
                if (released.has(revision)) counts.set(revision, (counts.get(revision) ?? 0) + 1);
            }
            await tx.agentRuns.update(run.id, {installedSkills: {version: 1, entries: kept}});
            affectedRuns++;
        }
        for (const revision of released) {
            const retention = retentions.get(revision)!;
            if (retention.runReferences !== (counts.get(revision) ?? 0)) throw new Error("技能执行引用计数不一致");
            await collectSkillRevision(revision, tx);
            retentions.delete(revision);
        }
        if (released.size) {
            await putSkillSetting(SKILL_CATALOGUE_KEY, {...catalogue, retainedRevisions: [...retentions.keys()],
                serializedBytes: [...retentions.values()].reduce((sum, retention) => sum + retention.serializedBytes, 0)}, tx);
        }
        return {releasedRevisions: released.size, affectedRuns, keptRevisions: historical.size - released.size};
    });
}
