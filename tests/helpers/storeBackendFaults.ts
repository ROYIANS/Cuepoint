import Dexie from "dexie";
import {expect,vi} from "vitest";
import type {ProductStore,StoreDriver,TransactionBackend} from "@/platform/storage/types";
import type {TableName} from "@/platform/storage/tableTypes";
import {getFixtureStoreDriver} from "../fixtures/shared-storage/storeFactory";

type Rule={method:"get"|"query"|"count"|"mutate";table:TableName;intercept:(backend:TransactionBackend,args:unknown[],next:()=>Promise<unknown>)=>Promise<unknown>};
const installations=new WeakMap<StoreDriver,{rules:Rule[];spy:ReturnType<typeof vi.spyOn>;wrapped:StoreDriver["transaction"]}>();

async function driverFor(store:ProductStore):Promise<StoreDriver> {
    const target=store.owner === "sqlite" ? (await import("../fixtures/shared-storage/nativeDatabase")).getNativeFixtureStore() : store;
    const driver=getFixtureStoreDriver(target);
    if (!driver) throw new Error("Fixture store must retain its real production driver");
    return driver;
}

/** Intercept actual adapter operations, including collection writes, without replacing them. */
export async function interceptStoreBackend(store:ProductStore,table:TableName,method:Rule["method"],intercept:Rule["intercept"]) {
    const driver=await driverFor(store);
    let installation=installations.get(driver);
    if (installation && driver.transaction !== installation.wrapped) {installations.delete(driver);installation=undefined;}
    const rule={method,table,intercept};
    if (installation) installation.rules.push(rule);
    else {
        const rules=[rule],original=driver.transaction.bind(driver);
        const spy=vi.spyOn(driver,"transaction").mockImplementation((mode,scope,callback)=>original(mode,scope,backend=> {
            const proxy=new Proxy(backend,{get(target,key) {
                const value=Reflect.get(target,key) as unknown;
                if (typeof value !== "function") return value;
                if (key !== "get" && key !== "query" && key !== "count" && key !== "mutate") return value.bind(target) as unknown;
                return (...args:unknown[])=> {
                    const table=key === "get" ? args[0] : (args[0] as {table:TableName}).table;
                    const matching=rules.filter(rule=>rule.method === key && rule.table === table);
                    let next=()=>Promise.resolve(Reflect.apply(value,target,args) as unknown);
                    for (const rule of [...matching].reverse()) {const proceed=next;next=()=>rule.intercept(proxy,args,proceed);}
                    return next();
                };
            }});
            return callback(proxy);
        }));
        installations.set(driver,{rules,spy,wrapped:driver.transaction});
    }
    return {mockRestore() {const current=installations.get(driver);if (!current) return;const position=current.rules.indexOf(rule);if (position >= 0) current.rules.splice(position,1);if (!current.rules.length) {current.spy.mockRestore();installations.delete(driver);}}};
}

export async function installStoreHook<Args extends unknown[]>(store:ProductStore,table:TableName,kind:"creating"|"updating"|"deleting"|"reading",callback:(...args:Args)=>unknown) {
    if (kind === "reading") {
        const intercept:Rule["intercept"]=async (_backend,_args,next)=> {
            const rows=await next() as Array<object|undefined>;
            return rows.map(row=>row === undefined ? row : Reflect.apply(callback,undefined,[row]));
        };
        const get=await interceptStoreBackend(store,table,"get",intercept),query=await interceptStoreBackend(store,table,"query",intercept);
        return {mockRestore() {get.mockRestore();query.mockRestore();}};
    }
    return interceptStoreBackend(store,table,"mutate",async (backend,args,next)=> {
        const mutation=args[0] as Parameters<TransactionBackend["mutate"]>[0];
        if (kind === "deleting" && mutation.kind === "delete") Reflect.apply(callback,undefined,[mutation.key]);
        else if (mutation.kind !== "delete") {
            const [before]=await backend.get(table,[mutation.key]);
            if (kind === "creating" && before === undefined) Reflect.apply(callback,undefined,[mutation.key,mutation.value]);
            if (kind === "updating" && before !== undefined) Reflect.apply(callback,undefined,[mutation.value,mutation.key,before]);
        }
        return next();
    });
}

/** Browser evidence stays the real IDBTransaction; native evidence is its accepted Rust begin. */
export async function actualStoreScope(store:ProductStore,backend:TransactionBackend):Promise<{mode:string;names:string[]}> {
    if (store.owner === "indexeddb") {
        const transaction=Dexie.currentTransaction;
        expect(transaction).toBeDefined();
        return {mode:transaction!.mode,names:Array.from(transaction!.idbtrans.objectStoreNames).sort()};
    }
    const receipt=(await import("../fixtures/shared-storage/nativeDatabase")).getNativeAcceptedScope(backend.transactionId);
    if (!receipt) throw new Error("Missing successful actual native begin receipt");
    return {mode:receipt.mode === "rw" ? "readwrite" : "readonly",names:[...receipt.tables].sort()};
}
