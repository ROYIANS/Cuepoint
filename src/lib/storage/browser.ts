import Dexie, {type IndexableType, liveQuery, type Transaction} from "dexie";
import {createId} from "@/lib/ids";
import {cloneStoredValue} from "./codec";
import {storageError, StorageError} from "./errors";
import {deliverStorageNotification} from "./notifications";
import type {NativeQuery, StoreKey} from "./protocol";
import {TABLE_NAMES} from "./schema";
import {createProductStore} from "./store";
import type {TableName} from "./tableTypes";
import type {ProductStore, StoreChange, StoreDriver, StoreObserver, TransactionBackend} from "./types";

function rawKey(key: StoreKey): IndexableType {
    return (key.kind === "array" ? key.value.map(rawKey) : (key.kind === "number" ? Number(key.value) : key.value)) as IndexableType;
}

class BrowserTransaction implements TransactionBackend {
    readonly transactionId = createId("transaction");
    private open = true;

    constructor(private readonly tx: Transaction, readonly mode: "r" | "rw", readonly scope: readonly TableName[]) {
    }

    close(): void {
        this.open = false;
    }

    assertOpen(): void {
        if (!this.open || !this.tx.active) throw new StorageError("closed", "Transaction is closed");
    }

    async get(table: TableName, keys: readonly string[]): Promise<Array<object | undefined>> {
        this.assertOpen();
        try {
            return await this.tx.table<object, string>(table).bulkGet([...keys]);
        } catch (error) {
            throw storageError(error);
        }
    }

    async query(query: NativeQuery): Promise<object[]> {
        try {
            return await this.collection(query).toArray();
        } catch (error) {
            throw storageError(error);
        }
    }

    async count(query: NativeQuery): Promise<number> {
        try {
            return await this.collection(query).count();
        } catch (error) {
            throw storageError(error);
        }
    }

    async mutate(mutation: Parameters<TransactionBackend["mutate"]>[0]): Promise<void> {
        this.assertOpen();
        if (this.mode !== "rw") throw new StorageError("scope", "Readonly transaction cannot write");
        const table = this.tx.table<object, string>(mutation.table);
        try {
            if (mutation.kind === "delete") await table.delete(mutation.key);
            else if (mutation.kind === "add") await table.add(cloneStoredValue(mutation.value));
            else await table.put(cloneStoredValue(mutation.value));
        } catch (error) {
            throw storageError(error);
        }
    }

    waitFor<T>(promise: Promise<T>): Promise<T> {
        this.assertOpen();
        return Dexie.waitFor(promise);
    }

    private collection(query: NativeQuery) {
        this.assertOpen();
        const table = this.tx.table<object, string>(query.table);
        let collection;
        if (query.selector.kind === "all") collection = query.index === null ? table.toCollection() : table.orderBy(query.index);
        else {
            if (!query.index) throw new StorageError("invalid", "Indexed selection requires a registered index");
            const where = table.where(query.index);
            const keys = query.selector.keys.map(rawKey);
            collection = query.selector.kind === "equals" ? where.equals(keys[0]) : where.anyOf(keys);
        }
        if (query.reverse) collection = collection.reverse();
        if (query.limit !== undefined) collection = collection.limit(query.limit);
        return collection;
    }
}

class BrowserStoreDriver implements StoreDriver {
    readonly owner = "indexeddb" as const;
    private readonly listeners = new Set<(change: StoreChange) => void>();
    private sequence = 0;

    constructor(private readonly database: Dexie) {
    }

    async transaction<T>(mode: "r" | "rw", scope: readonly TableName[], callback: (backend: TransactionBackend) => Promise<T>): Promise<T> {
        const result = await this.database.transaction(mode, scope.map(name => this.database.table(name)), async tx => {
            const backend = new BrowserTransaction(tx, mode, scope);
            try {
                return await callback(backend);
            } finally {
                backend.close();
            }
        });
        if (mode === "rw") {
            const change = {generation: 1, sequence: ++this.sequence, tables: scope};
            for (const listener of this.listeners) deliverStorageNotification(listener, change);
        }
        return result;
    }

    subscribe(listener: (change: StoreChange) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    waitFor<T>(promise: Promise<T>): Promise<T> {
        return Promise.resolve(promise);
    }

    observe<T>(query: (backend: TransactionBackend) => Promise<T>, observer: StoreObserver<T>): () => void {
        const subscription = liveQuery(() => this.transaction("r", TABLE_NAMES, query)).subscribe({
            next: value => deliverStorageNotification(item => observer.next(item), value),
            error: error => deliverStorageNotification(item => observer.error(item), error)
        });
        return () => subscription.unsubscribe();
    }
}

export interface BrowserStoreLifecycle {
    readonly name: string;
    readonly verno: number;

    open(): Promise<unknown>;

    close(): void;

    delete(): Promise<void>
}

export function createBrowserProductStore(database: Dexie): ProductStore & BrowserStoreLifecycle {
    const store = createProductStore(new BrowserStoreDriver(database)) as ProductStore & BrowserStoreLifecycle;
    Object.defineProperties(store, {
        name: {get: () => database.name},
        verno: {get: () => database.verno},
        open: {value: () => database.open()},
        close: {value: () => database.close()},
        delete: {value: () => database.delete()}
    });
    return store;
}
