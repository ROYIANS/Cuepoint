import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {APP_TOPBAR_CLEARANCE,popupCollisionPadding} from "@/components/ui/popupCollision";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

describe("floating panel clearance below the app top bar",()=>{
    it("is at least the top bar height from styles.css",()=>{
        const height=Number(/\.app-topbar \{[^}]*?\bheight: (\d+)px/.exec(read("packages/studio/src/styles.css"))?.[1]);
        expect(height).toBeGreaterThan(0);
        expect(APP_TOPBAR_CLEARANCE).toBeGreaterThan(height);
    });
    it("only the top edge differs from the requested edge padding",()=>{
        expect(popupCollisionPadding(12)).toEqual({top:APP_TOPBAR_CLEARANCE,right:12,bottom:12,left:12});
    });
    // A bare number pads every edge equally, letting a panel grow up under the top bar again.
    it.each([
        "packages/studio/src/components/ui/popover.tsx","packages/studio/src/components/ui/dropdown-menu.tsx","packages/studio/src/components/ui/select.tsx","packages/studio/src/components/ui/tooltip.tsx",
        "packages/studio/src/components/agent/ContextUsagePanel.tsx","packages/studio/src/components/agent/ModelSelectTrigger.tsx","packages/studio/src/components/agent/ProjectPicker.tsx","packages/studio/src/components/audio/AudioTimeline.tsx",
    ])("%s uses popupCollisionPadding",path=>{
        const source=read(path);
        expect(source).toContain("popupCollisionPadding(");
        expect(source).not.toMatch(/collisionPadding=\{\d+\}/);
    });
});
