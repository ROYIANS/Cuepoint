import {describe, expect, it} from "vitest";
import {db} from "@/db/database";

/**
 * Every `useProductQuery` callback runs inside one read transaction covering all tables.
 * Awaiting anything that is not a Dexie operation (a dynamic import, a timer, a fetch) lets
 * that transaction commit early, and the query then fails with `PrematureCommitError`,
 * which the hook rethrows into rendering. Work that needs such an await must run outside
 * the query. This pins the failure mode so the pattern is not reintroduced.
 */
function observeOnce<T>(query: (tx: Parameters<Parameters<typeof db.observe>[0]>[0]) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const stop = db.observe(query, {
            next: value => { stop(); resolve(value); },
            error: cause => { stop(); reject(cause); },
        });
    });
}

describe("product query transaction safety", () => {
    it("fails with PrematureCommitError when a query awaits a non-Dexie task", async () => {
        await expect(observeOnce(async () => {
            // Stands in for `await import("./models.generated.json")`: any non-Dexie wait.
            await new Promise(resolve => setTimeout(resolve, 20));
            return "late";
        })).rejects.toMatchObject({name: "PrematureCommitError"});
    });

    it("succeeds when the non-Dexie work happens before the query", async () => {
        const prepared = await new Promise<string>(resolve => setTimeout(() => resolve("ready"), 20));
        await expect(observeOnce(async tx => {
            await tx.chatThreads.toArray();
            return prepared;
        })).resolves.toBe("ready");
    });
});
