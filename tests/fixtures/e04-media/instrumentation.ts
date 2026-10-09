import {db} from "@/db/database";
import type {DBCore} from "dexie";

export interface Scan {
    table: string; method: string; index?: string | null; lower?: unknown;
    rangeType?: number; rows: number; keys?: number; stores: string[];
}
let active: Scan[] | undefined;
// Highest layer: observe the actual repository requests, including filtering cursor steps.
db.use({stack: "dbcore", name: "e04-media-work-count", level: 20, create(core: DBCore): DBCore {
    return {...core, table(name) {
        const table = core.table(name);
        const capture = (method: string, trans: unknown, extra: Partial<Scan> = {}) => {
            const native = trans as IDBTransaction;
            const scan: Scan = {table: name, method, rows: 0, stores: Array.from(native.objectStoreNames), ...extra};
            active?.push(scan); return scan;
        };
        return {...table,
            get(req) {
                const scan = active && capture("get", req.trans);
                return table.get(req).then(found => {if (scan) scan.rows = found === undefined ? 0 : 1; return found;});
            },
            getMany(req) {
                const scan = active && capture("getMany", req.trans, {keys: req.keys.length});
                return table.getMany(req).then(found => {if (scan) scan.rows = found.filter(row => row !== undefined).length; return found;});
            },
            query(req) {
                const scan = active && capture("query", req.trans, {index: req.query.index.name, lower: req.query.range.lower, rangeType: req.query.range.type});
                return table.query(req).then(found => {if (scan) scan.rows = found.result.length; return found;});
            },
            openCursor(req) {
                const scan = active && capture("cursor", req.trans, {index: req.query.index.name, lower: req.query.range.lower, rangeType: req.query.range.type});
                return table.openCursor(req).then(cursor => {
                    if (scan && cursor) {
                        const start = cursor.start;
                        cursor.start = function(onNext) {return start.call(cursor, () => {if (!cursor.done) scan.rows++; onNext();});};
                    }
                    return cursor;
                });
            },
            mutate(req) {
                const keys = "keys" in req ? req.keys?.length : undefined, values = "values" in req ? req.values?.length : undefined;
                const scan = active && capture(`mutate:${req.type}`, req.trans, {keys});
                return table.mutate(req).then(done => {if (scan) scan.rows = keys ?? values ?? 0; return done;});
            },
        };
    }};
}});
export async function observe<T>(operation: () => Promise<T>) {
    const scans: Scan[] = []; if (active) throw new Error("nested observer"); active = scans;
    try {return {value: await operation(), scans};} finally {active = undefined;}
}
