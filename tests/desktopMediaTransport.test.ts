import {describe, expect, it, vi} from "vitest";
import {createDesktopMediaServices, DesktopMediaUncertainError} from "@/platform/runtime/desktopMedia";
import type {NativeSession} from "@/platform/storage/protocol";

const session: NativeSession = {version: 1, session: "24d6f0af-8917-4b9e-8114-07b080a0cff6", workspaceId: "b923330b-f7aa-4477-8cff-b51954309668", generation: 1};
const action = {type: "pickDirectory", operationId: "22056e59-08a6-4842-a214-32c05320b59b"} as const;

describe("desktop media native availability certainty", () => {
    it("reports the exact native pre-reservation platform rejection as unavailable without status replay", async () => {
        const rejection = {code: "platform", message: "Local media is supported on macOS and Windows"};
        const call = vi.fn().mockRejectedValue(rejection);
        const services = createDesktopMediaServices(async () => session, call);

        let failure: unknown;
        try {await services.request("project", action);} catch (cause) {failure = cause;}

        expect(failure).toBeInstanceOf(Error);
        expect(failure).not.toBeInstanceOf(DesktopMediaUncertainError);
        expect((failure as Error).message).toContain("macOS 或 Windows");
        expect((failure as Error).message).not.toContain(rejection.message);
        expect(call).toHaveBeenCalledExactlyOnceWith("desktop_media_request", {request: {...session, projectId: "project", action}});
    });

    it.each([
        new Error("platform"),
        "platform",
        {code: "platform"},
        {code: "platform", message: "unsupported", extra: true},
        {code: "unknown", message: "result lost"},
    ])("keeps unrecognized native rejection uncertain: %j", async rejection => {
        const call = vi.fn().mockRejectedValue(rejection);
        const services = createDesktopMediaServices(async () => session, call);
        await expect(services.request("project", action)).rejects.toBeInstanceOf(DesktopMediaUncertainError);
        expect(call).toHaveBeenCalledTimes(1);
    });
});
