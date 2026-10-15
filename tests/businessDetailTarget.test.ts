import {describe, expect, it} from "vitest";
import {readBusinessDetailTarget, sameBusinessDetailTarget} from "@/app/details/businessDetailTarget";
import {assetDetailHref, type AssetDetailTarget} from "@/features/library/models/assetDetailTarget";
import {shotDetailHref} from "@/features/video/models/shotDetailTarget";

describe("finite business detail destinations", () => {
    it.each(["character", "scene", "prop", "style"] as const)("round-trips %s for both actual owners and hash navigation", kind => {
        for (const owner of [{kind: "studio"}, {kind: "project", projectId: "project 空间"}] as const) {
            const target: AssetDetailTarget = {kind, owner, entityId: "item+图=2"};
            const expected = {kind: "asset", target};
            expect(readBusinessDetailTarget(assetDetailHref(target))).toEqual(expected);
            expect(readBusinessDetailTarget(`#${assetDetailHref(target)}`)).toEqual(expected);
        }
    });
    it("keeps shot identity and compares every typed target fact", () => {
        const target = {projectId: "p", episodeId: "e", shotId: "s"};
        expect(readBusinessDetailTarget(shotDetailHref(target))).toEqual({kind: "shot", target});
        const a = {kind: "asset", target: {kind: "character", owner: {kind: "project", projectId: "p"}, entityId: "a"}} as const;
        expect(sameBusinessDetailTarget(a, {...a, target: {...a.target}})).toBe(true);
        for (const different of [
            {...a, target: {...a.target, kind: "prop"}},
            {...a, target: {...a.target, entityId: "b"}},
            {...a, target: {...a.target, owner: {kind: "studio"}}},
            {...a, target: {...a.target, owner: {kind: "project", projectId: "q"}}},
        ] as const) expect(sameBusinessDetailTarget(a, different)).toBe(false);
    });
    it("bounds decoded identities independently of encoded destination length", () => {
        const target: AssetDetailTarget = {kind: "style", owner: {kind: "project", projectId: "p".repeat(256)}, entityId: "a".repeat(256)};
        expect(readBusinessDetailTarget(assetDetailHref(target))).toEqual({kind: "asset", target});
        expect(readBusinessDetailTarget(assetDetailHref({...target, entityId: "a".repeat(257)}))).toBeNull();
        expect(readBusinessDetailTarget(assetDetailHref({...target, entityId: "图".repeat(256)}))).toBeNull();
    });
    it.each([
        "/characters", "/assets", "/p/p", "/p/p/e/e", "/p/p/world", "/ips/a", "/p/p/memory?memory=a", "#citation-1",
        "/characters/a/", "/characters/a/other", "/p/p/assets/characters/a?x=1", "/characters/a?", "/characters/a#x",
        "https://example.com/characters/a", "//example.com/characters/a", "/characters\\a", "/characters/%", "/characters/%E0%A4%A",
        "/characters/%2e%2e", "/characters/%2Foutside", "/characters/%5Coutside", "/characters/%00", "/characters/%1f", "/characters/%7f",
        "/p/%20p/assets/props/a", "/p/%2e%2e/assets/styles/a", "/p/p/assets/unknown/a", "/characters/a?shot=s&shot=t",
    ])("leaves unsupported or ambiguous destination alone: %s", href => expect(readBusinessDetailTarget(href)).toBeNull());
});
