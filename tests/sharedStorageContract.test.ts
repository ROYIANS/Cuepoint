import Dexie from "dexie";
import {describe,expect,it} from "vitest";
import {createBrowserProductStore} from "@/lib/storage/browser";
import {cloneStoredValue,decodeLocalValue,encodeLocalValue,registerBinaryReference} from "@/lib/storage/codec";
import {encodeProductRow} from "@/lib/storage/rowCodec";
import {PRODUCT_SCHEMA,TABLE_NAMES} from "@/lib/storage/schema";
import {targetRevision} from "@/lib/productionRevision";
import {validateEncodedValue} from "@/lib/storage/validate";
import {registerSharedStorageCases} from "./helpers/sharedStorageCases";

registerSharedStorageCases("indexeddb",async ()=> {
    const database=new Dexie("shared-contract-disposable");
    database.version(1).stores(Object.fromEntries(TABLE_NAMES.map(name=> {
        const definition=PRODUCT_SCHEMA[name];
        return [name,[definition.keyPath,...definition.indexes.map(index=>(index.unique ? "&" : "")+index.name)].join(",")];
    })));
    await database.open();
    return {store:createBrowserProductStore(database),close:()=>database.delete()};
});

describe("lossless local row codec",()=> {
    it("rejects unsupported cycles with a typed error without overflowing carrier traversal",async ()=> {
        const row:Record<string,unknown>={id:"cyclic"};row.extra=row;
        const clone=cloneStoredValue(row);
        expect(clone.extra).toBe(clone);
        await expect(encodeProductRow("projects",clone,async ()=> {throw new Error("no binary");})).rejects.toMatchObject({code:"invalid"});
    });
    it("preserves own undefined, reserved property names and receipt revision equality",async ()=> {
        const row=JSON.parse('{"id":"p","__proto__":{"visible":true},"value":["undef"],"extra":{"tag":"binary"}}') as Record<string,unknown>;
        row.cleared=undefined;row.nested={cleared:undefined,nullValue:null};
        const decoded=decodeLocalValue(validateEncodedValue(JSON.parse(JSON.stringify(await encodeLocalValue(row))))) as Record<string,unknown>;
        expect(decoded).toEqual(row);expect(Object.hasOwn(decoded,"cleared")).toBe(true);
        expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
        expect(targetRevision(decoded)).toBe(targetRevision(row));
    });
    it("retains original unpaired UTF16 values and property names exactly",async ()=> {
        const row={id:"p",["key\ud800"]:"body\udc00",nested:[NaN,Infinity,-Infinity,-0]};
        const encoded=await encodeLocalValue(row),decoded=decodeLocalValue(validateEncodedValue(JSON.parse(JSON.stringify(encoded))));
        expect(decoded).toEqual(row);expect(Object.is((decoded as typeof row).nested[3],-0)).toBe(true);
    });
    it("reconstructs long unpaired UTF16 property names without an argument limit",async ()=> {
        const key="k".repeat(180000)+"\ud800",row={id:"long-object-key",[key]:{retained:undefined,text:"original\udc00"}};
        const decoded=decodeLocalValue(validateEncodedValue(JSON.parse(JSON.stringify(await encodeLocalValue(row))))) as typeof row;
        expect(Object.keys(decoded)).toEqual(["id",key]);
        expect(decoded).toEqual(row);expect(Object.hasOwn(decoded[key],"retained")).toBe(true);
    });
    it("does not mistake user-shaped reference objects for managed binary authority",async ()=> {
        const raw={version:1,workspaceId:"w",binaryId:"b",byteLength:2,contentHash:"a".repeat(64),mimeType:"image/png"} as const;
        expect((await encodeLocalValue(raw))[0]).toBe("obj");
        const managed=registerBinaryReference(raw);
        expect((await encodeLocalValue(cloneStoredValue(managed)))[0]).toBe("binary");
    });
    it("limits binary externalization to all3registered carrier paths",async ()=> {
        const prepare=async ()=>({version:1,workspaceId:"w",binaryId:"b",byteLength:2,contentHash:"a".repeat(64),mimeType:"image/png"} as const),blob=new Blob(["hi"]);
        expect(decodeLocalValue(await encodeProductRow("media",{id:"m",blob},prepare))).toMatchObject({blob:{binaryId:"b",byteLength:2}});
        expect(decodeLocalValue(await encodeProductRow("materialVersions",{id:"v",payload:{type:"file",blob}},prepare))).toMatchObject({payload:{blob:{binaryId:"b",byteLength:2}}});
        expect(decodeLocalValue(await encodeProductRow("materialVersions",{id:"v",payload:{type:"setting",media:[{id:"m",blob}]}},prepare))).toMatchObject({payload:{media:[{blob:{binaryId:"b",byteLength:2}}]}});
        await expect(encodeProductRow("projects",{id:"p",extra:{blob}},prepare)).rejects.toMatchObject({code:"invalid"});
    });
    it.each([["undef",1],["num",null],["date","bad"],["bytes",[256]],["bogus"],["obj",[["a",["null"]],["a",["undef"]]]]])("rejects malformed codec reply %j",raw=> {
        expect(()=>validateEncodedValue(raw)).toThrow();
    });
});
