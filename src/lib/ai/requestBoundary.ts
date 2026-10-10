import {isReadAbort, readResponseJson} from "./boundedResponse";

type RequestWire = Omit<RequestInit, "signal" | "credentials" | "redirect">;
export type RequestBoundaryOptions = {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    credentials: RequestCredentials;
    redirect: RequestRedirect;
};

/** One application fetch invocation; caller owns URL, auth, timeout and decoding. */
export async function requestOnce(url: string, init: RequestWire, options: RequestBoundaryOptions): Promise<Response> {
    options.signal?.throwIfAborted();
    return (options.fetchImpl ?? fetch)(url, {
        ...init,
        signal: options.signal,
        credentials: options.credentials,
        redirect: options.redirect,
    });
}

type JsonReadPolicy =
    | { kind: "native-json" }
    | { kind: "bounded-json"; maxBytes: number; fatalUtf8: boolean };
export type HttpJsonReadPolicy = { success: JsonReadPolicy; failure: JsonReadPolicy };

/** Only unreadable optional HTTP diagnostics may be discarded. */
export async function readHttpJson(response: Response, policy: HttpJsonReadPolicy, signal?: AbortSignal): Promise<unknown> {
    const selected = response.ok ? policy.success : policy.failure;
    try {
        return selected.kind === "native-json"
            ? await response.json()
            : await readResponseJson(response, selected.maxBytes, signal, selected.fatalUtf8);
    } catch (error) {
        if (response.ok || isReadAbort(error, signal)) throw error;
        return undefined;
    }
}
