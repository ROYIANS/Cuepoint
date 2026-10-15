import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ActionIcon} from "@lobehub/ui/base-ui";
import {MotionProvider} from "@lobehub/ui/es/MotionProvider/index";
import * as motion from "motion/react-m";
import {describe, expect, it} from "vitest";
import {Home, Search} from "@/ui/icons";

describe("Phosphor icon rendering boundary", () => {
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
        expect(html).toContain('viewBox="0 0 256 256"');
        expect(html).toContain("search-glyph");
        expect(html).toContain('role="img" aria-label="搜索" focusable="false"');
        expect(html).not.toContain("stroke=");
        expect(html).not.toContain("stroke-width=");
    });

    it("renders distinct regular and fill states from the same Home component", () => {
        const ordinary = renderToStaticMarkup(createElement(Home, {weight: "regular", size: 16, "aria-hidden": true}));
        const active = renderToStaticMarkup(createElement(Home, {weight: "fill", size: 16, "aria-hidden": true}));
        expect(ordinary).toContain('viewBox="0 0 256 256"');
        expect(active).toContain('viewBox="0 0 256 256"');
        expect(ordinary).toContain('width="16" height="16"');
        expect(active).toContain('width="16" height="16"');
        expect(ordinary.match(/<path[^>]* d="([^"]+)"/)?.[1]).not.toEqual(active.match(/<path[^>]* d="([^"]+)"/)?.[1]);
    });

});
