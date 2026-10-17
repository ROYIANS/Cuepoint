import {describe,expect,it} from "vitest";
import {checkRegistryCompatibility} from "../apps/desktop/scripts/storage-compatibility.mjs";

describe("released native registry compatibility",()=>{
    it("retains verified additive compatibility for every legacy release",async ()=>{
        const result=await checkRegistryCompatibility();
        expect(result.releases).toEqual(expect.arrayContaining([
            "desktop-v0.1.0","desktop-v0.1.1","desktop-v0.1.2","desktop-v0.1.3","desktop-v0.1.4",
        ]));
    });
});
