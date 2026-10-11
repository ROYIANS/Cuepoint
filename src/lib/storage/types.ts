import type {NativeQuery,RowChange,WireMutation} from "./protocol";
import type {ProductRows,TableName} from "./tableTypes";

export interface StoreCollection<T extends object> {
    toArray():Promise<T[]>;
    count():Promise<number>;
    first():Promise<T|undefined>;
    filter(predicate:(row:T)=>boolean):StoreCollection<T>;
    and(predicate:(row:T)=>boolean):StoreCollection<T>;
    reverse():StoreCollection<T>;
    limit(count:number):StoreCollection<T>;
    sortBy(path:string):Promise<T[]>;
    each(callback:(row:T)=>void):Promise<void>;
    modify(patch:Partial<T>|((row:T)=>void)):Promise<number>;
    delete():Promise<number>;
}

export interface StoreWhere<T extends object> {
    equals(key:unknown):StoreCollection<T>;
    anyOf(keys:readonly unknown[]):StoreCollection<T>;
    anyOf(...keys:unknown[]):StoreCollection<T>;
}

export interface StoreTable<T extends object> {
    readonly name:TableName;
    get(key:string):Promise<T|undefined>;
    bulkGet(keys:readonly string[]):Promise<Array<T|undefined>>;
    toArray():Promise<T[]>;
    count():Promise<number>;
    where(index:string):StoreWhere<T>;
    orderBy(index:string):StoreCollection<T>;
    filter(predicate:(row:T)=>boolean):StoreCollection<T>;
    add(row:T):Promise<string>;
    put(row:T):Promise<string>;
    update(key:string,patch:Partial<T>):Promise<number>;
    delete(key:string):Promise<void>;
    bulkAdd(rows:readonly T[]):Promise<string>;
    bulkPut(rows:readonly T[]):Promise<string>;
    bulkDelete(keys:readonly string[]):Promise<void>;
    clear():Promise<void>;
}

export type AnyStoreTable=StoreTable<ProductRows[TableName]>;
export type TableScope=readonly (TableName|{readonly name:TableName})[];
export interface StoreChange {generation:number;sequence:number;tables:readonly TableName[];changes?:readonly RowChange[]}
export interface StoreObserver<T> {next(value:T):void;error(error:unknown):void}

interface StoreApi {
    readonly owner:"indexeddb"|"sqlite";
    readonly tables:readonly AnyStoreTable[];
    table<N extends TableName>(name:N):StoreTable<ProductRows[N]>;
    transaction<T>(mode:"r"|"rw",scope:TableScope,callback:(tx:StoreTx)=>Promise<T>|T):Promise<T>;
    waitFor<T>(promise:Promise<T>):Promise<T>;
    subscribe(listener:(change:StoreChange)=>void):()=>void;
    observe<T>(query:(tx:StoreTx)=>Promise<T>|T,observer:StoreObserver<T>):()=>void;
}
export type ProductStore=StoreApi & {[N in TableName]:StoreTable<ProductRows[N]>};
export type StoreTx=ProductStore & {readonly transactionId:string;readonly mode:"r"|"rw";readonly scope:readonly TableName[]};

/** Adapter internals; row payload types are narrowed by each typed table handle. */
export interface TransactionBackend {
    readonly transactionId:string;
    readonly mode:"r"|"rw";
    readonly scope:readonly TableName[];
    assertOpen():void;
    get(table:TableName,keys:readonly string[]):Promise<Array<object|undefined>>;
    query(query:NativeQuery):Promise<object[]>;
    count?(query:NativeQuery):Promise<number>;
    mutate(mutation:Omit<Extract<WireMutation,{kind:"put"|"add"}>,"value"|"key"> & {key:string;value:object}|Omit<Extract<WireMutation,{kind:"delete"}>,"key"> & {key:string}):Promise<void>;
    waitFor<T>(promise:Promise<T>):Promise<T>;
}

export interface StoreDriver {
    readonly owner:"indexeddb"|"sqlite";
    transaction<T>(mode:"r"|"rw",scope:readonly TableName[],callback:(backend:TransactionBackend)=>Promise<T>):Promise<T>;
    subscribe(listener:(change:StoreChange)=>void):()=>void;
    waitFor<T>(promise:Promise<T>):Promise<T>;
    observe<T>(query:(backend:TransactionBackend)=>Promise<T>,observer:StoreObserver<T>):()=>void;
}
