import {afterEach, describe, expect, it, vi} from "vitest";
import {installNativeExternalLinks} from "@/lib/runtimeExternalLinks";

const services = vi.hoisted(() => ({open: vi.fn(), error: vi.fn()}));
vi.mock("@/lib/nativeSystemServices", () => ({nativeOpenExternalUrl: services.open}));
vi.mock("sonner", () => ({toast: {error: services.error}}));

class TestElement {
    anchor?: TestAnchor;
    closest() { return this.anchor ?? null; }
}
class TestAnchor extends TestElement {
    constructor(readonly href: string) { super(); this.anchor = this; }
}

function setup(native: boolean, baseURI = "tauri://localhost/") {
    const handlers = new Map<string, (event: unknown) => void>();
    vi.stubGlobal("window", native ? {__TAURI_INTERNALS__: {invoke: vi.fn()}} : {});
    vi.stubGlobal("Element", TestElement);
    vi.stubGlobal("HTMLAnchorElement", TestAnchor);
    vi.stubGlobal("document", {
        baseURI,
        addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    });
    installNativeExternalLinks();
    return handlers;
}

function click(href: string, extra: Record<string, unknown> = {}) {
    const target = new TestElement();
    target.anchor = new TestAnchor(href);
    return {target, button: 0, defaultPrevented: false, preventDefault: vi.fn(), ...extra};
}

afterEach(() => {
    vi.unstubAllGlobals();
    services.open.mockReset();
    services.error.mockReset();
});

describe("native external link integration", () => {
    it("leaves browser anchor behavior intact", () => {
        expect(setup(false).size).toBe(0);
    });

    it.each(["click", "auxclick"])("opens nested external links through the OS on %s", async (type) => {
        const handlers = setup(true);
        const event = click("https://example.org/source?q=one#quote", {button: type === "auxclick" ? 1 : 0});
        handlers.get(type)?.(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(services.open).toHaveBeenCalledWith("https://example.org/source?q=one#quote"));
    });

    it("preserves internal hash routes and previously handled or right-click events", async () => {
        const handlers = setup(true);
        for (const event of [click("tauri://localhost/#/projects"), click("https://example.org", {defaultPrevented: true}), click("https://example.org", {button: 2})]) {
            handlers.get("click")?.(event);
            expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(services.open).not.toHaveBeenCalled();
    });

    it("keeps internal links inside an HTTP-based Tauri origin", () => {
        const handlers = setup(true, "http://tauri.localhost/");
        const event = click("http://tauri.localhost/#/projects", {button: 1});
        handlers.get("auxclick")?.(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(services.open).not.toHaveBeenCalled();
    });

    it("reports an OS opener failure without navigating the trusted main document", async () => {
        services.open.mockRejectedValue(new Error("system browser unavailable"));
        const handlers = setup(true);
        const event = click("https://example.org");
        handlers.get("click")?.(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(services.error).toHaveBeenCalledWith("打开链接失败：system browser unavailable"));
    });
});
