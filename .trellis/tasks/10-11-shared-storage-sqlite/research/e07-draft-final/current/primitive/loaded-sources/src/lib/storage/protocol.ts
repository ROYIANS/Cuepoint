import type {TableName} from "./tableTypes";
import type {ManagedBinaryRef} from "@/domain/binary";

/** Closed current IndexedDB index types; authored date fields use ISO strings. */
export type StoreKey = {kind:"string"; value:string} | {kind:"number"; value:number|"Infinity"|"-Infinity"} | {kind:"array"; value:StoreKey[]};
export type WireText=string|{utf16:number[]};
export type NativeBinaryRef = ManagedBinaryRef;
export interface BinaryClaim {reference:NativeBinaryRef;stageId:string}
export type EncodedValue = ["undef"] | ["null"] | ["bool",boolean] | ["str",string] | ["utf16",number[]] |
    ["num",number|"NaN"|"Infinity"|"-Infinity"|"-0"] | ["arr",EncodedValue[]] |
    ["obj",Array<[string,EncodedValue]>] | ["obj16",Array<[number[],EncodedValue]>] | ["date",string] | ["bytes",number[]] | ["binary",NativeBinaryRef];
export interface WireRow {key:string; value:EncodedValue}
export type WireRowValue={kind:"inline";row:WireRow}|{kind:"transfer";transferId:string};
export type WireMutation = {kind:"put"|"add";table:TableName;key:WireText;value:EncodedValue} | {kind:"delete";table:TableName;key:WireText};
export type WireBatchEntry = {kind:"mutation";mutation:WireMutation}|{kind:"claim";claim:BinaryClaim};
export interface NativeSession {version:1;session:string;workspaceId:string;generation:number}
export interface TransactionHandle extends NativeSession {handle:string;operationId:string}
export interface NativeQuery {
    table:TableName;
    index:string|null;
    selector:{kind:"all"}|{kind:"equals"|"anyOf";keys:StoreKey[]};
    reverse:boolean;
    cursor:string|null;
    pageSize:number;
    limit?:number;
}
export interface CommitResult {status:"committed";operationId:string;fingerprint:string;changeSequence:number;tables:TableName[]}
export interface RowChange {table:TableName;key:string;before:Record<string,StoreKey>;after:Record<string,StoreKey>}
type WireRowChange=RowChange|{kind:"transfer";transferId:string};
export type OperationOutcome = CommitResult | {status:"rolledBack";operationId:string} | {status:"unknown"|"pending"|"notFound";operationId:string};

/** All calls use a closed request under the trusted native main-window boundary. */
export interface NativeStoreBridge {
    open():Promise<NativeSession & {changeSequence:number}>;
    begin(request:NativeSession & {operationId:string;mode:"r"|"rw";tables:TableName[]}):Promise<TransactionHandle>;
    get(request:TransactionHandle & {table:TableName;keys:string[]}):Promise<{rows:Array<WireRowValue|null>}>;
    query(request:TransactionHandle & {query:NativeQuery}):Promise<{rows:WireRowValue[];cursor:string|null;epoch:number}>;
    count(request:TransactionHandle & {query:NativeQuery}):Promise<{count:number}>;
    readTransfer(request:TransactionHandle & {transferId:string;offset:number;byteLength:number}):Promise<{payload:string;offset:number;end:boolean}>;
    prepare(request:TransactionHandle & {chunkIndex:number;payload:string}):Promise<{nextChunk:number}>;
    seal(request:TransactionHandle & {chunkCount:number;fingerprint:string}):Promise<{capability:string;fingerprint:string}>;
    commit(request:TransactionHandle & {capability:string;fingerprint:string}):Promise<CommitResult>;
    validate(request:TransactionHandle):Promise<void>;
    abort(request:TransactionHandle):Promise<void>;
    status(request:NativeSession & {operationId:string;fingerprint:string}):Promise<OperationOutcome>;
    changes(request:NativeSession & {changeSequence:number;cursor:string|null;pageSize:number}):Promise<{changes:WireRowChange[];cursor:string|null}>;
    readChangeTransfer(request:NativeSession & {transferId:string;offset:number;byteLength:number}):Promise<{payload:string;offset:number;end:boolean}>;
}

export const IPC_CHUNK_BYTES = 262144;
/** String envelopes may escape each code unit sixfold; raw binary ranges use the larger budget. */
export const IPC_TEXT_CHUNK_BYTES = 32768;
export const QUERY_PAGE_SIZE = 256;
