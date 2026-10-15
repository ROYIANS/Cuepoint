import {vi} from "vitest";
import type {ProductStore,StoreTx,TableScope} from "@/platform/storage/types";
import type {TableName} from "@/platform/storage/tableTypes";

type Interceptor={table:TableName;method:string;intercept:(tx:StoreTx,args:unknown[],next:()=>Promise<unknown>)=>Promise<unknown>};
const installations=new WeakMap<ProductStore,{rules:Interceptor[];spy:ReturnType<typeof vi.spyOn>;wrapped:ProductStore["transaction"]}>();

/** Inject at the actual explicit transaction table, including joined child handles. */
export function interceptStoreTable(store:ProductStore, table:TableName, method:string, intercept:(tx:StoreTx,args:unknown[],next:()=>Promise<unknown>)=>Promise<unknown>) {
    let installation=installations.get(store);
    if (installation && store.transaction !== installation.wrapped) {installations.delete(store);installation=undefined;}
    const rule={table,method,intercept};
    if (installation) {installation.rules.push(rule);return {mockRestore:()=>remove()};}
    const rules=[rule];
    const wrap=(tx:StoreTx):StoreTx=>new Proxy(tx,{
        get(target,key,receiver) {
            const wrapTable=(name:TableName)=> {
                const handle=target.table(name);
                return new Proxy(handle,{get(rowTarget,rowKey) {
                    const original=Reflect.get(rowTarget,rowKey) as unknown;
                    const matching=rules.filter(rule=>rule.table === name && rule.method === rowKey);
                    if (!matching.length || typeof original !== "function") return original;
                    return (...args:unknown[])=> {
                        let next=()=>Promise.resolve(Reflect.apply(original,rowTarget,args) as unknown);
                        for (const rule of [...matching].reverse()) {const proceed=next;next=()=>rule.intercept(receiver as StoreTx,args,proceed);}
                        return next();
                    };
                }});
            };
            if (key === "transaction") return <T>(mode:"r"|"rw",scope:TableScope,callback:(inner:StoreTx)=>Promise<T>|T)=>target.transaction(mode,scope,inner=>callback(wrap(inner)));
            if (key === "table") return wrapTable;
            if (typeof key === "string" && rules.some(rule=>rule.table === key)) return wrapTable(key as TableName);
            return Reflect.get(target,key,receiver) as unknown;
        }
    });
    const original=store.transaction.bind(store);
    const spy=vi.spyOn(store,"transaction").mockImplementation((mode,scope,callback)=>original(mode,scope,tx=>callback(wrap(tx))));
    installation={rules,spy,wrapped:store.transaction};installations.set(store,installation);
    return {mockRestore:()=>remove()};
    function remove() {const current=installations.get(store);if (!current) return;const position=current.rules.indexOf(rule);if (position >= 0) current.rules.splice(position,1);if (!current.rules.length) {current.spy.mockRestore();installations.delete(store);}}
}

export function failStoreTableOnce(store:ProductStore, table:TableName, method:string, failure:Error) {
    let failed=false;
    return interceptStoreTable(store,table,method,async (_tx,_args,next)=> {
        if (!failed) {failed=true;throw failure;}
        return next();
    });
}
