import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const css=readFileSync(new URL("../packages/studio/src/ui/theme.css",import.meta.url),"utf8");

// The hamburger trigger also carries .app-header-shortcut, which sets display:flex later in the file.
// A lone .app-mobile-nav-trigger rule has equal specificity and loses, so the button showed at every
// width and overlapped the macOS traffic lights.
describe("mobile navigation trigger visibility",()=>{
    it("is hidden by a rule that out-ranks .app-header-shortcut",()=>{
        expect(css).toMatch(/^\.app-header-shortcut\.app-mobile-nav-trigger\s*\{\s*display:\s*none;\s*\}/m);
        expect(css).not.toMatch(/^\.app-mobile-nav-trigger\s*\{/m);
    });
    it("is shown only inside the narrow-window media query",()=>{
        const narrow=css.slice(css.indexOf("@media (max-width: 767px) {"));
        const block=narrow.slice(0,narrow.indexOf("\n}\n"));
        expect(block).toMatch(/\.app-header-shortcut\.app-mobile-nav-trigger\s*\{\s*display:\s*flex;\s*\}/);
        expect(css.replace(block,"")).not.toMatch(/app-mobile-nav-trigger\s*\{\s*display:\s*flex/);
    });
});
