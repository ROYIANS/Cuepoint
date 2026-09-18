# UI walkthrough and AI boundary review

Date: 2026-09-18. Source: actual local browser interactions plus source contracts. No product code was changed.

## Browser walkthrough
- On the local development origin, created a clearly labeled synthetic film project `审查样例 · 雨夜送信`, entered title/logline/script, manually added a beat, created character 阿宁 and scene 旧车站, and assigned them to the beat. Returned story showed saved text and selected links. This verifies ordinary sequential authoring, not concurrency safety.
- Film project creation correctly navigates directly to the internal episode story, but the page still says 本集故事 / 集标题 / 本集一句话. This is a terminology mismatch for single-film mode.
- Returning from project character detail to 世界 reset the selected tab to 设定 instead of returning to 角色. Source: AssetLibraryPage.tsx:103 and bare detail back links.
- Dev-origin shot module navigation failed with the default English `Something went wrong!` / failed dynamic import. Direct HTTP source returned 200 and reload still failed. Do not classify this as a proven production shot-route bug.
- Launched the existing production build via local pnpm preview on `127.0.0.1:5175`, using separate origin storage. Created `审查样例 · 生产预览`; manually added a beat and shot, entered content and duration, switched design/media views, opened the clip editor, and reached production checklist successfully. This rules out a blanket claim that the current production shot route is broken.
- Slot editor does expose manual 上传结果, but the copy frames it as 最终生成素材 / 槽位主体是提示词和参考. For manual-first users this hides the actual purpose: attach an existing image/video and optionally provide preparation notes. Source: GenerationSlotCard.tsx:190,234.
- At 390×844, the shot toolbar compresses 制作分镜 into a narrow vertical stack, and actions extend beyond the viewport. Grid horizontal scrolling is expected for many columns, but the primary toolbar should remain usable independently. Source: ShotEditorPage.tsx:669–701 fixed-height non-wrapping flex row. The production checklist itself remains usable at the same viewport, though content cells are narrow. Viewport override was reset.
- Production sample with content and 5s duration correctly reported missing scene/first frame/clip and exposed CSV/print/locate actions. No actual media upload or exported-file visual verification was performed in this audit.
- Synthetic sample records remain only in the two local browser origins; no existing user projects or credentials were edited/deleted. Preview server session belongs to this audit and can be stopped after examination.

## UX interpretation
The product already has clear studio/project grouping and ordinary manual entry. It does not yet meet a high reliability/usability bar: saving is inconsistent by module, return navigation loses context, labels/actions need accessibility fixes, and narrow-screen shot controls need a deliberate layout. Avoid assigning a spurious numerical “extreme UX score”; evaluate observable completion, error recovery, discoverability and keyboard/touch access.

## AI-ready foundations present
- Owner IDs, project/episode boundaries, independent studio snapshots, centralized repo operations.
- Shared GenerationSlot shape with prompt, reference image/video IDs and selected result.
- Local Blob records plus project-package media collection/remapping; provider connectors separate from project data.
- Existing world constraints and beat/shot/asset structure can be resolved as context without making AI mandatory.

## Missing contracts before asynchronous writeback
- Atomic updates: current read/merge/put loses independent concurrent fields, reproduced by peers. Fix before jobs write results.
- Typed target: owner, entity kind/id and slot/field, plus existence/ownership validation.
- Input revision/snapshot and apply guard: late generated outputs must not overwrite manual edits silently.
- Explicit context resolution: project world/default style + beat/shot relationships + referenced asset renditions, with deterministic inheritance and missing-reference reporting.
- Provenance/selected candidate: provider/model/parameters/source kind/timestamps without API keys; candidate history and job storage need separate lifecycle design.
- Reusable commands: manual and AI apply paths use the same validators/repository transaction contract. Arbitrary `extra` fields are not a substitute for known relationship or concurrency contracts.

No need to build the AI executor now. Repair manual invariants, add concrete asset relations and expose context/apply contracts first; durable generation scheduling belongs to the later integration task.

## Error recovery addition
Root route defines only `component` (src/routes/__root.tsx:7). A controlled error boundary with retry/reload and return-to-project navigation is a useful foundation change. The observed dev-load failure demonstrates poor recovery copy; it does not prove production failures are frequent.
