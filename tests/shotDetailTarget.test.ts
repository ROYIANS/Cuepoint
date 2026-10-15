import {describe, expect, it} from "vitest";
import {readShotDetailTarget} from "@/app/details/shotDetailTarget";
import {shotDetailHref} from "@/features/video/models/shotDetailTarget";

describe("bounded historical shot destinations", () => {
    it("round-trips an owned canonical destination and native hash form", () => {
        const target = {projectId: "project 空间", episodeId: "episode+2", shotId: "shot=3"};
        expect(readShotDetailTarget(shotDetailHref(target))).toEqual(target);
        expect(readShotDetailTarget(`#${shotDetailHref(target)}`)).toEqual(target);
    });
    it("accepts the ID bound and rejects longer IDs and destinations", () => {
        const target = {projectId: "p".repeat(256), episodeId: "e".repeat(256), shotId: "s".repeat(256)};
        expect(readShotDetailTarget(shotDetailHref(target))).toEqual(target);
        for (const field of ["projectId", "episodeId", "shotId"] as const) {
            expect(readShotDetailTarget(shotDetailHref({...target, [field]: target[field] + "x"}))).toBeUndefined();
        }
        // The decoded ID is within its bound, but its encoded URL exceeds the href bound.
        expect(readShotDetailTarget(shotDetailHref({projectId: "项".repeat(256), episodeId: "e", shotId: "s"}))).toBeUndefined();
    });
    it.each([0, 1, 31, 127])("rejects control character %i in every decoded identity", code => {
        const target = {projectId: "project", episodeId: "episode", shotId: "shot"};
        for (const field of ["projectId", "episodeId", "shotId"] as const) {
            expect(readShotDetailTarget(shotDetailHref({...target, [field]: `a${String.fromCharCode(code)}b`}))).toBeUndefined();
        }
    });
    it.each([
        "/p/p/e/e/shots", "/p/p/e/e/shots?shot=", "/p/p/e/e/shots?shot=a&shot=b",
        "/p/p/e/e/shots?shot=a&unknown=b", "/p/p/e/e/shots?shot=a#section",
        "//outside/p/p/e/e/shots?shot=a", "https://outside/p/p/e/e/shots?shot=a",
        "/p/p%2Fforeign/e/e/shots?shot=a", "/p/p/e/e/shots?shot=%5Cforeign",
        "/p/%/e/e/shots?shot=a", "/p/p/e/e/shots?shot=%", "/p/p/e/e/shots?shot=%E0%A4%A",
        "/p/p/e/e/shots?shot=%00", "/p/p/e/e/shots?shot=..",
        "/p/p/e/e/../e/shots?shot=a", "#citation-1", "/p/p/world",
    ])("leaves unsupported or ambiguous destination untouched: %s", href => {
        expect(readShotDetailTarget(href)).toBeUndefined();
    });
});
