import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ActionIcon} from "@lobehub/ui/base-ui";
import {MotionProvider} from "@lobehub/ui/es/MotionProvider/index";
import * as motion from "motion/react-m";
import {describe, expect, it} from "vitest";
import {Search} from "@/components/ui/remixIcons";

describe("Remix icon rendering boundary", () => {
    it("stays visible through LobeUI's native ActionIcon and transparent fill default", () => {
        const html = renderToStaticMarkup(createElement(MotionProvider, {
            motion,
            children: createElement(ActionIcon, {
                icon: Search, title: "搜索话题", "aria-label": "搜索话题",
            }),
        }));
        expect(html).toContain("<button");
        expect(html).toContain('aria-label="搜索话题"');
        expect(html).toMatch(/<svg[^>]*fill="currentColor"/);
        expect(html).not.toContain('fill="transparent"');
        expect(html).not.toContain("stroke-width=");
        expect(html).toContain("<path");
    });

    it("preserves explicit color, semantic size and accessibility without stroke geometry", () => {
        const html = renderToStaticMarkup(createElement(Search, {
            color: "#abcdef", size: 18, className: "search-glyph", role: "img",
            "aria-label": "搜索", focusable: false,
            fill: "transparent", stroke: "red", strokeWidth: 8,
            width: 400, height: 200, viewBox: "0 0 400 200",
        }));
        expect(html).toContain('fill="#abcdef"');
        expect(html).toContain('width="18" height="18"');
        expect(html).toContain('viewBox="0 0 24 24"');
        expect(html).toContain("search-glyph");
        expect(html).toContain('role="img" aria-label="搜索" focusable="false"');
        expect(html).not.toContain("stroke=");
        expect(html).not.toContain("stroke-width=");
    });

});
