# C06 spec draft — append after independent PASS with exact accepted limits

## 1. Scope / Trigger
Inbound provider JSON/error bodies, speech audio/base64 envelopes, CDN downloads, and Chat/Responses streaming accumulation.

## 2. Signatures
`readResponseBytes/Text/Json/Blob` share actual Uint8Array byte enforcement while consuming a Response body, before parsing or Blob construction. `readSseEvents` handles bounded UTF-8 events and cancellation. Policies in `src/lib/resource/limits.ts`: error 64 KiB, ordinary JSON and retained chat output 4 MiB, raw audio 32 MiB, MiMo speech envelope ceil(audioLimit/3)*4 + 4 MiB, protected/public image/video binary download 256 MiB. These are local application limits, not supplier specifications. Tavily remains at 2 MiB. Audio byte limits agree with the existing decoder guard.

## 3. Contracts
Content-Length is a hint, never the only enforcement. Reject an oversized body during reading, cancel and release the reader, and preserve AbortError semantics. Check exact decoded base64 size including padding before allocating and validate the resulting Blob. An SSE response bounds each pending line/event and the aggregate retained content/reasoning/tool output before delivering an over-limit delta; repeated legal usage-only events do not consume a lifetime response allowance. Retained output accounting handles UTF-16 surrogate pairs split across JSON deltas: charge actual appended UTF-8 bytes, rather than summing independent encodings that overcount a completed pair. Responses' existing event/output protections remain.

An oversized successful response is a protocol failure, not proof the remote paid submission did not execute. When a non-2xx status was already observed, preserve the adapter’s authoritative HTTP status contract while bounding/cancelling the error body; AbortError retains its existing exception. Speech follows existing uncertain-state handling without automatic resubmission. Music preserves already checkpointed task IDs/results and supports GET/CDN recovery without a new POST. Do not decode or fetch inside database transactions. Provider status reporting and redaction-before-truncation remain unchanged. An over-limit successful download reports the resource boundary rather than disguising it as a generic network/cross-origin error. Known non-2xx bodies still report authoritative status even if the bounded optional diagnostic body cannot be read. Exact scoped APIs are recorded in the accepted review; this contract does not claim every discovery or inline image JSON endpoint is now bounded.

## 4. Validation / Error Matrix
| Input | Required result |
| --- | --- |
| Exact configured byte boundary | Accept if otherwise valid |
| Missing or misleading Content-Length | Enforce actual streamed bytes |
| Limit crossed in one or multiple chunks | Cancel and reject before parsing/persistence |
| Base64 envelope with decoded size above audio limit | Reject before atob/Blob allocation |
| Abort while reading | Preserve abort classification |
| Many legal SSE usage events | Continue when retained state is bounded |
| Single huge event or accumulated output overflow | Stop before unsafe handler output |
| Oversized paid-submission response | Preserve uncertainty; no automatic second POST |
| Oversized music CDN body | Keep task IDs and recover through GET |

## 5. Good / Base / Bad Cases
Good: a bounded read rejects a fake-small Content-Length body before constructing a large Blob. Base: ordinary streamed reasoning and tools still finish. Bad: reading the complete body and checking its size afterward, or retrying a paid POST because its response was too large.

## 6. Required Tests
Finite mocked streams covering exact boundaries, cross-chunk/multibyte bytes, absent/fake headers, cancellation/release, abort, base64 padding, per-event and aggregate SSE limits, existing tool finishes, nonstreaming Responses, actual request counts, no media persistence, uncertain jobs and preserved music checkpoints. These tests prove control-flow boundaries rather than live-provider memory behavior or OOM prevention measurements.

## 7. Wrong vs Correct
Wrong: call response.json/text/blob with no bound or trust only the header. Correct: enforce the relevant actual-byte limit before materialization and preserve provider/runtime failure semantics.
