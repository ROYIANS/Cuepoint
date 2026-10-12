import {intercept,persist} from "./metrics";
import {afterAll} from "vitest";
import {createNativeProbe} from "/Users/xiaomengdao/WebstormProjects/aifenjing/tests/helpers/nativeProductProbe";
import {installNativeBinaryAccess} from "@/lib/storage/binary";
import type {NativeBinaryServices} from "@/lib/storage/nativeBinary";
import type {ProductStore} from "@/lib/storage/types";
import type {BrowserStoreLifecycle} from "@/lib/storage/browser";

// This explicit lane requires the real Rust binary; a missing probe is a failure.
let native=await createNativeProbe({intercept});
let lifecycle:Promise<void>=Promise.resolve();
const services=new Proxy({} as NativeBinaryServices,{get(_target,key) {
    const value=Reflect.get(native.binaries,key) as unknown;
    return typeof value === "function" ? value.bind(native.binaries) as unknown : value;
}});
installNativeBinaryAccess(services);

const transaction:ProductStore["transaction"]=(mode,scope,callback)=>native.store.transaction(mode,scope,callback);
const target={transaction} as ProductStore & BrowserStoreLifecycle;
export const db=new Proxy(target,{get(target,key) {
    if (Object.hasOwn(target,key)) return Reflect.get(target,key) as unknown;
    if (key === "name") return "real-native-product-fixture";
    if (key === "verno") return 1;
    if (key === "close") return ()=> {lifecycle=lifecycle.then(()=>native.reopen());};
    if (key === "open") return ()=>lifecycle;
    if (key === "delete") return async ()=> {await lifecycle;await native.close();native=await createNativeProbe({intercept});lifecycle=Promise.resolve();};
    const value=Reflect.get(native.store,key) as unknown;
    return typeof value === "function" ? value.bind(native.store) as unknown : value;
},set(target,key,value) {return Reflect.set(target,key,value);},getOwnPropertyDescriptor(target,key) {
    return Reflect.getOwnPropertyDescriptor(target,key) ?? {...Reflect.getOwnPropertyDescriptor(native.store,key),configurable:true};
}});

export async function initializeProductStorage():Promise<void> {await lifecycle;}
export function getNativeFixtureStore():ProductStore {return native.store;}
export function getNativeAcceptedScope(transactionId:string) {return native.acceptedScopes.get(transactionId);}
afterAll(async ()=> {try{await lifecycle;await native.close();}finally{await persist();}});
