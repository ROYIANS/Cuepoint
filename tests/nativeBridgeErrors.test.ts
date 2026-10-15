import {describe,expect,it} from "vitest";
import {createNativeStoreBridge} from "@/platform/storage/nativeBridge";
import {StorageError} from "@/platform/storage/errors";

const rejecting=(raw:unknown)=>createNativeStoreBridge(async ()=>{throw raw;});

describe("native bridge transport errors",()=>{
    it("keeps known Rust codes as StorageError",async ()=>{
        const error=await rejecting({code:"conflict",message:"busy"}).open().catch(e=>e);
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe("conflict");
    });
    it("names an unrecognized Rust code without leaking its message",async ()=>{
        const error=await rejecting({code:"schema",message:"Unsupported full-product workspace format /Users/x"}).open().catch(e=>e);
        expect(error).not.toBeInstanceOf(StorageError);
        expect((error as Error).message).toBe("原生存储连接失败（schema）");
    });
    it.each([{code:"Bad Code!",message:"x"},{code:5,message:"x"},"plain",null])("falls back to the generic message for %j",async raw=>{
        const error=await rejecting(raw).open().catch(e=>e);
        expect((error as Error).message).toBe("原生存储连接失败");
    });
});
