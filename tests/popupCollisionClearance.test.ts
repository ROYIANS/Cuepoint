import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {APP_TOPBAR_CLEARANCE,popupCollisionPadding} from "@/ui/popupCollision";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

describe("floating panel clearance below the app top bar",()=>{
    it("is at least the top bar height from styles.css",()=>{
        const height=Number(/\.app-topbar \{[^}]*?\bheight: (\d+)px/.exec(read("packages/studio/src/ui/theme.css"))?.[1]);
        expect(height).toBeGreaterThan(0);
        expect(APP_TOPBAR_CLEARANCE).toBeGreaterThan(height);
    });
    it("only the top edge differs from the requested edge padding",()=>{
        expect(popupCollisionPadding(12)).toEqual({top:APP_TOPBAR_CLEARANCE,right:12,bottom:12,left:12});
    });
    it.each([
        ["packages/studio/src/ui/popover.tsx","max-h-(--radix-popover-content-available-height)"],
        ["packages/studio/src/ui/popover.tsx","max-w-(--radix-popover-content-available-width)"],
        ["packages/studio/src/ui/dropdown-menu.tsx","max-h-(--radix-dropdown-menu-content-available-height)"],
        ["packages/studio/src/ui/select.tsx","max-h-(--radix-select-content-available-height)"],
        ["packages/studio/src/features/agent/ui/composerControls.css","100dvh - 68px"],
        ["packages/studio/src/features/agent/ui/composerControls.css","--radix-popover-content-available-height"],
    ])("%s bounds popup size: %s",(path,token)=>{
        expect(read(path)).toContain(token);
    });
    it("sub-menus scroll instead of clipping",()=>{
        const source=read("packages/studio/src/ui/dropdown-menu.tsx");
        const sub=source.slice(source.indexOf("function DropdownMenuSubContent"));
        expect(sub).toContain("overflow-y-auto");
        expect(sub).not.toContain("overflow-hidden");
    });
    // A bare number pads every edge equally, letting a panel grow up under the top bar again.
    it.each([
        "packages/studio/src/ui/popover.tsx","packages/studio/src/ui/dropdown-menu.tsx","packages/studio/src/ui/select.tsx","packages/studio/src/ui/tooltip.tsx",
        "packages/studio/src/features/agent/ui/ContextUsagePanel.tsx","packages/studio/src/features/agent/ui/ModelSelectTrigger.tsx","packages/studio/src/features/agent/ui/ProjectPicker.tsx","packages/studio/src/features/audio/ui/AudioTimeline.tsx",
    ])("%s uses popupCollisionPadding",path=>{
        const source=read(path);
        expect(source).toContain("popupCollisionPadding(");
        expect(source).not.toMatch(/collisionPadding=\{\d+\}/);
    });
});
