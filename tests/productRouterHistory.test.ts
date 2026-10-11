import {afterEach, describe, expect, it, vi} from "vitest";
import {createProductRouterHistory} from "@/lib/productRouterHistory";

function browserWindow(href: string, native: boolean) {
    let location = new URL(href);
    let state: unknown = null;
    const history = {
        get state() { return state; },
        length: 1,
        pushState(next: unknown, _title: string, url?: string | URL | null) {
            state = next;
            if (url != null) location = new URL(url, location);
            history.length += 1;
        },
        replaceState(next: unknown, _title: string, url?: string | URL | null) {
            state = next;
            if (url != null) location = new URL(url, location);
        },
        back: vi.fn(), forward: vi.fn(), go: vi.fn(),
    };
    const window = {
        get location() { return location; },
        history,
        document: {baseURI: href},
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        ...(native ? {__TAURI_INTERNALS__: {invoke: vi.fn()}} : {}),
    };
    vi.stubGlobal("document", window.document);
    vi.stubGlobal("window", window);
    return window;
}

afterEach(() => vi.unstubAllGlobals());

describe("shared product router history", () => {
    it.each(["/", "/index.html"])("keeps native navigation and reload on the trusted %s document", (entry) => {
        const window = browserWindow(`tauri://localhost${entry}`, true);
        const history = createProductRouterHistory();
        history.push("/projects");
        history.flush();
        expect(history.location.pathname).toBe("/projects");
        expect(window.location.pathname).toBe(entry);
        expect(window.location.search).toBe("");
        expect(window.location.hash).toBe("#/projects");

        history.push("/p/native-project/story?episodeId=episode-2");
        history.flush();
        expect(window.location.pathname).toBe(entry);
        expect(window.location.search).toBe("");
        expect(window.location.hash).toBe("#/p/native-project/story?episodeId=episode-2");
        history.destroy();

        const reloaded = createProductRouterHistory();
        expect(reloaded.location.pathname).toBe("/p/native-project/story");
        expect(reloaded.location.search).toBe("?episodeId=episode-2");
        expect(window.location.pathname).toBe(entry);
        reloaded.destroy();
    });

    it("preserves browser path navigation and direct reload", () => {
        const window = browserWindow("http://localhost:5173/", false);
        const history = createProductRouterHistory();
        history.push("/projects?archived=true");
        history.flush();
        expect(window.location.pathname).toBe("/projects");
        expect(window.location.search).toBe("?archived=true");
        expect(window.location.hash).toBe("");
        history.destroy();

        const reloaded = createProductRouterHistory();
        expect(reloaded.location.pathname).toBe("/projects");
        expect(reloaded.location.search).toBe("?archived=true");
        reloaded.destroy();
    });
});
