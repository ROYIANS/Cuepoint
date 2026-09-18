/** Own only uploads created during this editor session, never existing/shared media. */
export class DraftMediaSession {
  private owned = new Set<string>();
  private pending = new Set<Promise<unknown>>();
  private closed = false;
  private saving = false;

  constructor(private readonly deleteIfOrphan: (id: string) => Promise<void>) {}

  async upload<T extends { id: string }>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.closed || this.saving || this.pending.size) throw new Error("请等待当前素材操作完成");
    const work = operation().then((uploaded) => {
      this.owned.add(uploaded.id);
      return uploaded;
    });
    this.pending.add(work);
    try {
      const uploaded = await work;
      return this.closed ? undefined : uploaded;
    } finally {
      this.pending.delete(work);
    }
  }

  async discardExcept(keptIds: readonly string[]): Promise<void> {
    const kept = new Set(keptIds);
    for (const id of this.owned) {
      if (kept.has(id)) continue;
      await this.deleteIfOrphan(id);
      this.owned.delete(id);
    }
  }

  async save(keptIds: readonly string[], persist: () => Promise<void>): Promise<void> {
    if (this.closed || this.saving || this.pending.size) throw new Error("请等待当前素材操作完成");
    this.saving = true;
    const work = (async () => {
      await this.discardExcept(keptIds);
      await persist();
      // Committed IDs now belong to the record; cancellation must not reclaim them.
      for (const id of keptIds) this.owned.delete(id);
    })();
    this.pending.add(work);
    try {
      await work;
    } finally {
      this.pending.delete(work);
      this.saving = false;
    }
  }

  async cancel(): Promise<void> {
    this.closed = true;
    await Promise.allSettled([...this.pending]);
    await this.discardExcept([]);
  }
}
