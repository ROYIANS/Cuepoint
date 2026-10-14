import {describe, expect, it, vi} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Switch} from "@/components/ui/switch";

describe("settings switch", () => {
    it.each([false, true])("uses a named native button with the checked state %s", checked => {
        const html = renderToStaticMarkup(createElement(Switch, {
            checked, onCheckedChange: vi.fn(), "aria-label": "启动时自动检查更新",
        }));
        expect(html).toMatch(/^<button[^>]*type="button"/);
        expect(html).toContain('role="switch"');
        expect(html).toContain(`aria-checked="${checked}"`);
        expect(html).toContain('aria-label="启动时自动检查更新"');
        expect(html).toContain('aria-hidden="true"');
    });

    it.each([false, true])("passes the toggled value from the production click callback for %s", checked => {
        const onCheckedChange = vi.fn();
        const element = Switch({checked, onCheckedChange});
        element.props.onClick();
        expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(!checked);
    });

    it("preserves the native disabled state during unavailable or pending storage", () => {
        const html = renderToStaticMarkup(createElement(Switch, {
            checked: false, disabled: true, onCheckedChange: vi.fn(), "aria-label": "启动时自动检查更新",
        }));
        expect(html).toContain('disabled=""');
    });
});
