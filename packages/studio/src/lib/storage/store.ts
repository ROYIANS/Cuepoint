import {cloneStoredValue} from "./codec";
import {StorageError} from "./errors";
import {compareKeys, keyOf, primaryKey, propertyAt, requireKey} from "./keys";
import type {NativeQuery} from "./protocol";
import {QUERY_PAGE_SIZE} from "./protocol";
import {TABLE_NAMES, tableDefinition} from "./schema";
import type {ProductRows, TableName} from "./tableTypes";
import type {
    AnyStoreTable,
    ProductStore,
    StoreCollection,
    StoreDriver,
    StoreObserver,
    StoreTable,
    StoreTx,
    StoreWhere,
    TableScope,
    TransactionBackend
} from "./types";

type Access = <R>(write: boolean, callback: (backend: TransactionBackend) => Promise<R>) => Promise<R>;

class Collection<T extends object> implements StoreCollection<T> {
    constructor(private readonly table: TableName, private readonly access: Access, private readonly query: NativeQuery, private readonly predicates: readonly ((row: T) => boolean)[] = [], private readonly maximum = Infinity) {
    }

    toArray(): Promise<T[]> {
        return this.access(false, backend => this.rows(backend));
    }

    count(): Promise<number> {
        return this.access(false, async backend => {
            if (!this.predicates.length && backend.count) return Math.min(await backend.count(this.query), this.maximum);
            return (await this.rows(backend)).length;
        });
    }

    first(): Promise<T | undefined> {
        return this.limit(1).toArray().then(rows => rows[0]);
    }

    filter(predicate: (row: T) => boolean): StoreCollection<T> {
        return new Collection(this.table, this.access, this.query, [...this.predicates, predicate], this.maximum);
    }

    and(predicate: (row: T) => boolean): StoreCollection<T> {
        return this.filter(predicate);
    }

    reverse(): StoreCollection<T> {
        return new Collection(this.table, this.access, {
            ...this.query,
            reverse: !this.query.reverse
        }, this.predicates, this.maximum);
    }

    limit(count: number): StoreCollection<T> {
        if (!Number.isInteger(count) || count < 0) throw new StorageError("invalid", "Invalid query limit");
        return new Collection(this.table, this.access, this.query, this.predicates, Math.min(count, this.maximum));
    }

    async sortBy(path: string): Promise<T[]> {
        const rows = await this.toArray();
        const direction = this.query.reverse ? -1 : 1;
        return rows.sort((left, right) => {
            const a = keyOf(propertyAt(left, path));
            const b = keyOf(propertyAt(right, path));
            if (!a && !b) return 0;
            if (!a) return -direction;
            if (!b) return direction;
            return direction * compareKeys(a, b);
        });
    }

    async each(callback: (row: T) => void): Promise<void> {
        for (const row of await this.toArray()) callback(row);
    }

    modify(patch: Partial<T> | ((row: T) => void)): Promise<number> {
        return this.access(true, async backend => {
            const rows = await this.rows(backend);
            for (const row of rows) {
                const key = primaryKey(row, tableDefinition(this.table));
                if (typeof patch === "function") patch(row); else Object.assign(row, cloneStoredValue(patch));
                if (primaryKey(row, tableDefinition(this.table)) !== key) throw new StorageError("invalid", "Cannot modify a primary key");
                await backend.mutate({kind: "put", table: this.table, key, value: row});
            }
            return rows.length;
        });
    }

    delete(): Promise<number> {
        return this.access(true, async backend => {
            const rows = await this.rows(backend);
            for (const row of rows) await backend.mutate({
                kind: "delete",
                table: this.table,
                key: primaryKey(row, tableDefinition(this.table))
            });
            return rows.length;
        });
    }

    private rows(backend: TransactionBackend): Promise<T[]> {
        const query = backend.mode === "r" && !this.predicates.length && Number.isFinite(this.maximum) ? {
            ...this.query,
            limit: this.maximum
        } : this.query;
        return backend.query(query).then(rows => rows.map(row => cloneStoredValue(row as T)).filter(row => this.predicates.every(predicate => predicate(row))).slice(0, this.maximum));
    }
}

class TableHandle<T extends object> implements StoreTable<T> {
    constructor(readonly name: TableName, private readonly access: Access) {
    }

    get(key: string): Promise<T | undefined> {
        return this.bulkGet([key]).then(rows => rows[0]);
    }

    bulkGet(keys: readonly string[]): Promise<Array<T | undefined>> {
        return this.access(false, async backend => (await backend.get(this.name, keys)).map(row => row === undefined ? undefined : cloneStoredValue(row as T)));
    }

    toArray(): Promise<T[]> {
        return this.collection(null).toArray();
    }

    count(): Promise<number> {
        return this.collection(null).count();
    }

    where(index: string): StoreWhere<T> {
        return {
            equals: key => this.collection(index, {kind: "equals", keys: [requireKey(key)]}),
            anyOf: (...input: unknown[]) => {
                const keys = input.length === 1 && Array.isArray(input[0]) ? input[0] : input;
                return this.collection(index, {kind: "anyOf", keys: keys.map(requireKey)});
            },
        };
    }

    orderBy(index: string): StoreCollection<T> {
        return this.collection(index);
    }

    filter(predicate: (row: T) => boolean): StoreCollection<T> {
        return this.collection(null).filter(predicate);
    }

    add(row: T): Promise<string> {
        return this.save("add", [row]);
    }

    put(row: T): Promise<string> {
        return this.save("put", [row]);
    }

    bulkAdd(rows: readonly T[]): Promise<string> {
        return this.save("add", rows);
    }

    bulkPut(rows: readonly T[]): Promise<string> {
        return this.save("put", rows);
    }

    update(key: string, patch: Partial<T>): Promise<number> {
        return this.access(true, async backend => {
            const [row] = await backend.get(this.name, [key]);
            if (!row) return 0;
            const next = Object.assign(cloneStoredValue(row), cloneStoredValue(patch));
            if (primaryKey(next, tableDefinition(this.name)) !== key) throw new StorageError("invalid", "Cannot update a primary key");
            await backend.mutate({kind: "put", table: this.name, key, value: next});
            return 1;
        });
    }

    delete(key: string): Promise<void> {
        return this.bulkDelete([key]);
    }

    bulkDelete(keys: readonly string[]): Promise<void> {
        return this.access(true, async backend => {
            for (const key of keys) await backend.mutate({kind: "delete", table: this.name, key});
        });
    }

    clear(): Promise<void> {
        return this.collection(null).delete().then(() => undefined);
    }

    private collection(index: string | null, selector: NativeQuery["selector"] = {kind: "all"}): StoreCollection<T> {
        const definition = tableDefinition(this.name);
        if (index !== null && index !== definition.keyPath && !definition.indexes.some(item => item.name === index)) throw new StorageError("invalid", "Unregistered product index");
        return new Collection(this.name, this.access, {
            table: this.name,
            index,
            selector,
            reverse: false,
            cursor: null,
            pageSize: QUERY_PAGE_SIZE
        });
    }

    private save(kind: "add" | "put", rows: readonly T[]): Promise<string> {
        return this.access(true, async backend => {
            let key = "";
            for (const row of rows) {
                const snapshot = cloneStoredValue(row);
                key = primaryKey(snapshot, tableDefinition(this.name));
                await backend.mutate({kind, table: this.name, key, value: snapshot});
            }
            return key;
        });
    }
}

function normalizeScope(scope: TableScope): TableName[] {
    const names = scope.map(value => typeof value === "string" ? value : value.name);
    for (const name of names) tableDefinition(name);
    return [...new Set(names)];
}

function makeStore(driver: StoreDriver, backend?: TransactionBackend): ProductStore | StoreTx {
    const tableCache = new Map<TableName, StoreTable<ProductRows[TableName]>>();
    const store = {
        owner: driver.owner,
        table<N extends TableName>(name: N): StoreTable<ProductRows[N]> {
            tableDefinition(name);
            const found = tableCache.get(name);
            if (found) return found as StoreTable<ProductRows[N]>;
            const access: Access = (write, callback) => {
                if (backend) {
                    backend.assertOpen();
                    if (!backend.scope.includes(name) || (write && backend.mode === "r")) return Promise.reject(new StorageError("scope", "Transaction table or mode is not declared"));
                    return callback(backend);
                }
                return driver.transaction(write ? "rw" : "r", [name], callback);
            };
            const table = new TableHandle<ProductRows[N]>(name, access);
            tableCache.set(name, table as StoreTable<ProductRows[TableName]>);
            return table;
        },
        transaction<T>(mode: "r" | "rw", scope: TableScope, callback: (tx: StoreTx) => Promise<T> | T): Promise<T> {
            const names = normalizeScope(scope);
            if (backend) {
                backend.assertOpen();
                if ((mode === "rw" && backend.mode === "r") || names.some(name => !backend.scope.includes(name))) return Promise.reject(new StorageError("scope", "Nested transaction cannot widen its root"));
                // A nested handle restricts its own declared scope while sharing root state.
                const narrowed: TransactionBackend = {
                    ...backend,
                    transactionId: backend.transactionId,
                    mode,
                    scope: names,
                    assertOpen: () => backend.assertOpen(),
                    get: (table, keys) => backend.get(table, keys),
                    query: query => backend.query(query), ...(backend.count ? {count: (query: NativeQuery) => backend.count!(query)} : {}),
                    mutate: mutation => backend.mutate(mutation),
                    waitFor: promise => backend.waitFor(promise)
                };
                return Promise.resolve(callback(makeStore(driver, narrowed) as StoreTx));
            }
            return driver.transaction(mode, names, async root => callback(makeStore(driver, root) as StoreTx));
        },
        waitFor<T>(promise: Promise<T>): Promise<T> {
            return backend ? backend.waitFor(promise) : driver.waitFor(promise);
        },
        subscribe: driver.subscribe.bind(driver),
        observe<T>(query: (tx: StoreTx) => Promise<T> | T, observer: StoreObserver<T>): () => void {
            if (backend) throw new StorageError("scope", "Cannot subscribe through a transaction handle");
            return driver.observe(async root => query(makeStore(driver, root) as StoreTx), observer);
        },
    } as ProductStore;
    Object.defineProperty(store, "tables", {get: () => TABLE_NAMES.map(name => store.table(name)) as AnyStoreTable[]});
    for (const name of TABLE_NAMES) Object.defineProperty(store, name, {get: () => store.table(name)});
    if (backend) {
        Object.defineProperties(store, {
            transactionId: {value: backend.transactionId},
            mode: {value: backend.mode},
            scope: {value: backend.scope}
        });
    }
    return store;
}

export function createProductStore(driver: StoreDriver): ProductStore {
    return makeStore(driver);
}
