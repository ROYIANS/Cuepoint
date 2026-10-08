import type {GenerationSlot, Id, MediaKind} from "@/domain/types";

/** One manual editor opening owns one target, baseline and save callback. */
export class SlotEditSession {
    readonly baseline: GenerationSlot;
    readonly resultKinds: readonly MediaKind[];

    constructor(
        readonly targetKey: string,
        readonly projectId: Id,
        readonly title: string,
        value: GenerationSlot,
        resultKinds: readonly MediaKind[],
        private readonly persist: (draft: GenerationSlot, baseline: GenerationSlot) => Promise<void>,
    ) {
        this.baseline = structuredClone(value);
        this.resultKinds = [...resultKinds];
    }

    assertTarget(targetKey: string): void {
        if (targetKey !== this.targetKey) throw new Error("编辑目标已切换，草稿已保留。请关闭此编辑器后重新打开目标槽位");
    }

    save(draft: GenerationSlot, targetKey: string): Promise<void> {
        this.assertTarget(targetKey);
        return this.persist(draft, this.baseline);
    }
}
