import {invoke} from "@tauri-apps/api/core";
import {getProductStorage} from "@/lib/productStorage";
import {createBrowserProductStore,type BrowserStoreLifecycle} from "@/lib/storage/browser";
import {browserDatabase} from "@/lib/storage/browserDatabase";
import {createNativeStoreBridge} from "@/lib/storage/nativeBridge";
import {createNativeProductStore} from "@/lib/storage/native";
import {createNativeBinaryServices,nativeBinaryTransport} from "@/lib/storage/nativeBinary";
import {installNativeBinaryAccess} from "@/lib/storage/binary";
import {StorageError} from "@/lib/storage/errors";
import type {ProductStore} from "@/lib/storage/types";

function selectProductStore():ProductStore & BrowserStoreLifecycle {
    if (getProductStorage().storage === "indexeddb") {
        if (!browserDatabase) throw new StorageError("unavailable","浏览器存储未创建");
        return createBrowserProductStore(browserDatabase);
    }
    const bridge=createNativeStoreBridge((command,args)=>invoke(command,args));
    const services=createNativeBinaryServices(nativeBinaryTransport(()=>driver.getSession()));
    const {store,driver}=createNativeProductStore(bridge,services);
    installNativeBinaryAccess(services);
    Object.defineProperties(store,{name:{value:getProductStorage().databaseName},verno:{value:1},open:{value:()=>driver.getSession()},close:{value:()=>undefined},delete:{value:()=>Promise.reject(new StorageError("scope","原生工作区不允许通过浏览器重置接口删除"))}});
    return store as ProductStore & BrowserStoreLifecycle;
}

/** One fixed authoritative owner per startup, shared by every current business command. */
export const db=selectProductStore();
export async function initializeProductStorage():Promise<void> {await db.open();}
