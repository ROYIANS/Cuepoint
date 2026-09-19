# Intake foundation evidence — 2026-09-19

## User decisions
Common image/text/PDF/DOCX formats together; project-shared references, selected material in current request and other sources read on demand. These answers resolve the two product scope questions. Task preparation is authorized; product implementation is not yet activated.

## Local code anchors
- `src/components/agent/AgentControls.tsx`: searchable plus menu currently contains memory, parameters and skills.
- `src/domain/types.ts:350`: MediaRecord stores Blob/project/filename/MIME; `:536`: ChatMessage stores string content, no references.
- `src/domain/agent.ts:26`: AgentRequestMessage is string-content based. `src/lib/ai/responsesStream.ts:24`: toResponseInput converts that structure.
- `src/db/repo.ts:547`: collectMediaIds; `:589`: deleteMediaIfOrphan; `:1619`: deleteChatThread. Extend these existing ownership seams rather than invent unrelated blob deletion.
- `src/lib/ai/modelBank/index.ts`: fast lookup currently projects context/output limits only; full lazy dataset preserves all upstream fields. Vision capability needs separate verified projection or explicit connector metadata.
- `src/components/media/MediaPicker.tsx`, `src/components/slots/GenerationSlotCard.tsx`: existing media selection/reuse patterns.
- `src/lib/agent/generationProfiles.ts`: adapter-specific generation reference restrictions remain authoritative.
- `package.json`: no PDF.js or Mammoth dependency currently; preserve explicit machine pnpm path despite packageManager metadata.

## LobeHub reference
Local checkout: `/Users/xiaomengdao/WebstormProjects/lobehub`.
- `packages/file-loaders/src/loaders/pdf/index.ts`: lazy PDF.js, Node readFile, getDocument/getPage/getTextContent, per-page text/metadata and resource cleanup. It requires a browser-specific adapter here.
- `packages/file-loaders/src/loaders/docx/index.ts`: Mammoth extractRawText on a Node buffer; plain extracted text and diagnostics, not faithful rendered pages.
- `packages/file-loaders/src/loaders/text/index.ts`: UTF BOM detection and text line metadata. Browser TextDecoder replaces Node filesystem/buffer usage.

## Primary documentation checked
- https://github.com/mwilliamson/mammoth.js — browser entrypoint, ArrayBuffer input, extractRawText and paragraph separation; explicit warning that generated HTML is not sanitized. Choose raw text.
- https://mozilla.github.io/pdf.js/examples/ — browser document loading, worker configuration and page access. Bundle worker locally; dependency versions and Vite asset behavior must be verified in implementation.

These references support parser selection, not a claim of complete rendering fidelity. Provider image schemas/capabilities remain an explicit implementation verification before transport changes; do not infer them from a model label or maximum context length.

## Previous batch lesson
Native asynchronous callbacks inside repeated Dexie entity lookup paths caused real-browser premature transaction commits despite fake-indexeddb success. Keep file I/O, hashing, parsing, worker waits and model transport out of transactions; include native-browser stress coverage and missing-owner handling. Archived memory retrieval validation contains the reproduction and fix evidence.
