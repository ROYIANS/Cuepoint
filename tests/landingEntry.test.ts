// @vitest-environment jsdom
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {GITHUB_URL} from "@/lib/brand";
import {Landing} from "@/landing/Landing";

// Claims the product does not support (task research, section 3.3).
const FORBIDDEN_CLAIMS = ["云同步", "跨设备自动同步", "多人协作", "实时协作", "一键成片", "完整英文", "账号登录", "自动渲染", "全自动", "免费额度", "试用 Key", "后台执行"];

const html = readFileSync(resolve(process.cwd(), "landing.html"), "utf8");
const documentFromHtml = new DOMParser().parseFromString(html, "text/html");
const compact = (text: string | null) => (text ?? "").replace(/\s+/g, "");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(Landing)));
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("landing page content", () => {
    it("links to the app, the releases page and GitHub", () => {
        const link = (name: string) => [...container.querySelectorAll("a")].find(a => a.textContent === name);
        expect(link("进入应用")?.getAttribute("href")).toBe("/agent");
        expect(link("在浏览器中体验")?.getAttribute("href")).toBe("/agent");
        expect(link("下载桌面版")?.getAttribute("href")).toBe(`${GITHUB_URL}/releases`);
        expect(link("GitHub")?.getAttribute("href")).toBe(GITHUB_URL);
        expect(container.querySelector("h1")?.textContent).toBe("小光点 Cuepoint");
    });

    it("declares every external link and uses no remote images", () => {
        for (const a of container.querySelectorAll("a[href^='http']")) {
            expect(a.getAttribute("href")!.startsWith(GITHUB_URL)).toBe(true);
            expect(a.getAttribute("rel")).toContain("noopener");
        }
        for (const img of container.querySelectorAll("img")) expect(img.getAttribute("src")).toMatch(/^\/brand\//);
    });

    it("makes no unsupported claims", () => {
        const text = [container.textContent ?? "", documentFromHtml.body.textContent ?? "", html].join("\n");
        expect(FORBIDDEN_CLAIMS.filter(claim => text.includes(claim))).toEqual([]);
    });
});

describe("landing.html", () => {
    it("holds static content identical to the React render, so a script failure still shows the page", () => {
        const staticRoot = documentFromHtml.getElementById("root");
        expect(compact(staticRoot?.textContent ?? null)).toBe(compact(container.textContent));
        const hrefs = (scope: ParentNode) => [...scope.querySelectorAll("a")].map(a => a.getAttribute("href"));
        expect(hrefs(staticRoot!)).toEqual(hrefs(container));
    });

    it("has SEO metadata and no application styles or scripts", () => {
        const meta = (selector: string) => documentFromHtml.querySelector(selector)?.getAttribute("content") ?? documentFromHtml.querySelector(selector)?.getAttribute("href");
        expect(documentFromHtml.documentElement.lang).toBe("zh-CN");
        expect(meta("link[rel=canonical]")).toBe("https://cue.vidorra.life/");
        expect(meta("meta[name=theme-color]")).toBe("#101010");
        expect(meta("meta[name=description]")).toBeTruthy();
        expect(meta("meta[property='og:image']")).toMatch(/^https:\/\/cue\.vidorra\.life\/brand\/logo-lockup\.webp/);
        expect(meta("meta[name='twitter:card']")).toBe("summary_large_image");
        const ld = JSON.parse(documentFromHtml.querySelector("script[type='application/ld+json']")!.textContent!) as Record<string, unknown>;
        expect(ld["@type"]).toBe("SoftwareApplication");
        expect(ld.downloadUrl).toBe(`${GITHUB_URL}/releases`);
        expect(JSON.stringify(ld)).not.toMatch(/\d+\.\d+\.\d+/);
        expect(html).not.toContain("styles.css");
        expect([...documentFromHtml.querySelectorAll("script[src]")].map(s => s.getAttribute("src"))).toEqual(["/src/landing/main.tsx"]);
    });

    it("subsets the display font and falls back without blocking", () => {
        const href = documentFromHtml.querySelector("link[href*='fonts.googleapis.com/css2']")!.getAttribute("href")!;
        expect(href).toContain("display=swap");
        expect(decodeURIComponent(href)).toContain("text=小光点 Cuepoint");
    });
});
