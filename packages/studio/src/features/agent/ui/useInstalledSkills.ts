import {useRef, useState} from "react";
import {useProductQueryState} from "../../../platform/product/queries";
import {createId} from "../../../platform/identity";
import {StorageError} from "../../../platform/storage/errors";
import {getInstalledSkillCatalogue} from "../skills/queries/installedSkills";
import {installSkill, reconcileSkillMutation, setInstalledSkillEnabled, uninstallSkill, updateInstalledSkill} from "../skills/commands/installations";
import type {InstalledSkill, SkillCatalogue, SkillImportCandidate, SkillMutationExpectation, SkillMutationReceipt} from "../skills/models/installedSkill";

type UncertainMutation = SkillMutationExpectation & {readonly conflicted: boolean; readonly done?: () => void};
type OptimisticToggle = {readonly skillId: string; readonly enabled: boolean; readonly catalogueRevision?: number};

/** One owner spans quick switches and the retained panel, including uncertainty. */
export function useInstalledSkills() {
    const [attempt, setAttempt] = useState(0);
    const query = useProductQueryState(tx => getInstalledSkillCatalogue(tx), [attempt]);
    const [fresh, setFresh] = useState<SkillCatalogue>();
    const catalogue = fresh && (!query.value || fresh.revision > query.value.revision) ? fresh : query.value;
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string>();
    const [uncertain, setUncertain] = useState<UncertainMutation>();
    const [optimistic, setOptimistic] = useState<OptimisticToggle>();
    const lock = useRef(false);
    const current = useRef({catalogue, uncertain});
    current.current = {catalogue, uncertain};
    // Uncertain intent stays visible until reconciliation. A confirmed toggle
    // yields to a catalogue that has reached its receipt, even if readback failed.
    const toggle = optimistic && (optimistic.catalogueRevision === undefined || !catalogue || catalogue.revision < optimistic.catalogueRevision) ? optimistic : undefined;
    const entries = catalogue?.entries.map(entry => toggle?.skillId === entry.skillId ? {...entry, enabled: toggle.enabled} : entry) ?? [];

    async function refresh() {
        if (lock.current) return;
        lock.current = true;
        setPending(true);
        try {
            setFresh(await getInstalledSkillCatalogue());
            // Only an explicit acknowledgement of a reported conflicting writer
            // releases that intent. An unresolved readback is never a rollback.
            if (current.current.uncertain?.conflicted) {
                setUncertain(undefined);
                setOptimistic(undefined);
            }
            setError(undefined);
            setAttempt(value => value + 1);
        } catch (cause) {setError(cause instanceof Error ? cause.message : "技能列表读取失败，请重试");}
        finally {lock.current = false; setPending(false);}
    }

    async function mutate(action: (expected: SkillMutationExpectation) => Promise<SkillMutationReceipt>, toggle?: OptimisticToggle, done?: () => void) {
        const value = current.current;
        if (lock.current || value.uncertain || !value.catalogue || query.error) return;
        const expected = {operationId: createId("skillmutation"), catalogueRevision: value.catalogue.revision};
        lock.current = true;
        setPending(true);
        setError(undefined);
        setOptimistic(toggle);
        try {
            const receipt = await action(expected);
            setOptimistic(value => value && {...value, catalogueRevision: receipt.catalogueRevision});
            // Acknowledged success remains success even if the follow-up read fails.
            done?.();
            try {setFresh(await getInstalledSkillCatalogue());}
            catch {setAttempt(value => value + 1);}
        } catch (cause) {
            if (cause instanceof StorageError && cause.certainty === "unknown") {
                const intent = {...expected, conflicted: false, done};
                current.current = {...current.current, uncertain: intent};
                setUncertain(intent);
                setError("保存结果尚未确认，请先核对；不要重复提交。");
            } else {
                setOptimistic(undefined);
                setError(cause instanceof Error ? cause.message : "技能设置保存失败，请重试");
            }
        } finally {lock.current = false; setPending(false);}
    }

    async function reconcile() {
        const intent = current.current.uncertain;
        if (lock.current || !intent) return;
        lock.current = true;
        setPending(true);
        try {
            const result = await reconcileSkillMutation(intent);
            if (result.status === "committed") {
                setOptimistic(value => value && {...value, catalogueRevision: result.receipt.catalogueRevision});
                intent.done?.();
                setUncertain(undefined);
                setError(undefined);
                try {setFresh(await getInstalledSkillCatalogue());} catch {setAttempt(value => value + 1);}
            } else if (result.status === "conflict") {
                setUncertain({...intent, conflicted: true});
                setError("其他操作已改变技能列表，无法确认原操作结果。请重新查看当前列表，再决定下一步。");
            } else setError("仍无法确认保存结果，当前操作已保留。请稍后再次核对。");
        } catch (cause) {setError(cause instanceof Error ? cause.message : "无法核对保存结果，请稍后再试");}
        finally {lock.current = false; setPending(false);}
    }

    return {
        catalogue, entries, pending, uncertain, error: error ?? query.error?.message,
        blocked: pending || !!uncertain || !catalogue || !!query.error,
        isPending: () => lock.current || !!current.current.uncertain,
        refresh, reconcile,
        install: (candidate: SkillImportCandidate, enabled: boolean, done?: () => void) => mutate(expected => installSkill({...expected, candidate, enabled}), undefined, done),
        update: (skill: InstalledSkill, candidate: SkillImportCandidate, done?: () => void) => mutate(expected => updateInstalledSkill({...expected, skillId: skill.skillId, expectedRevision: skill.revision, candidate}), undefined, done),
        toggle: (skill: InstalledSkill, enabled: boolean) => mutate(expected => setInstalledSkillEnabled({...expected, skillId: skill.skillId, expectedRevision: skill.revision, enabled}), {skillId: skill.skillId, enabled}),
        uninstall: (skill: InstalledSkill, done?: () => void) => mutate(expected => uninstallSkill({...expected, skillId: skill.skillId, expectedRevision: skill.revision}), undefined, done),
    };
}

export type InstalledSkillsController = ReturnType<typeof useInstalledSkills>;
