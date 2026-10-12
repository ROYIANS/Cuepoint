# Release source-list buffer failure: change boundary

## Observed gap

The owner pasted a macOS ARM64 build failure in `build-release.mjs` at the first `sourceHashes()` call: `execFileSync(git, ls-files -z)` throws `ENOBUFS` and terminates Git with SIGTERM before frontend compilation. The default synchronous Node24.11 stdout/stderr buffer is1MiB. This is a packaging-script enumeration failure, not an automated test or a compiler failure.

Actual local repository output is2,396,578bytes across19,936tracked paths. The existing hash scope excludes `.trellis/`, `.agents/` and `.codex/`; its1,460eligible paths occupy only59,538NUL-delimited path bytes. The current implementation buffers all excluded metadata before filtering. The unchanged source reproduces ENOBUFS locally on the approved Node24.11.0, with1,114,112bytes returned before Git termination. These local counts identify the same failure mechanism; the pasted hosted output does not establish exact hosted repository counts.

Primary reference: https://nodejs.org/download/release/v24.11.0/docs/api/child_process.html#child_processexecfilesyncfile-args-options documents the1MiB default and child termination on overflow.

## Smallest behavior gap and ownership

- Preserve the exact existing source hash set, sorted deterministic keys, NUL-safe paths and before/after comparisons; avoid buffering excluded metadata and the default1MiB synchronous output ceiling.
- Implementer owns `desktop/tauri/scripts/build-release.mjs` and a narrowly named source-list/hash helper and regression file under the same scripts directory if extraction is needed for actual-process testing. Prefer filtering the three already-excluded root prefixes at Git enumeration and consuming large lists asynchronously, rather than a new arbitrary maxBuffer or excluding additional source paths.
- Test actual temporary Git indexes whose total or eligible path output exceeds1MiB. Check parity with the existing sorted prefix-filter reference, UTF8/spaces/newline path handling, before/after hashes including a changed eligible file, and actual Git failure propagation without accepting partial source proof. Use bounded temporary fixtures; no huge task evidence tree.
- Readonly research audits duplicate enumeration/available helpers and reports whether other calls share the reached failure. Do not refactor unrelated process tools.
- Root owns task/spec changes and final Git coordination. Independent Trellis check reviews the final exact scope.

## Explicit boundaries and verification

The desktop Actions workflow remains package-only. Do not add CI test/quality/smoke steps, change receipt/product/features/version/host/signing/draft behavior, weaken clean-source or hash checks, delete/reorganize task history, alter product/Agent/native storage code, migrate old data or modify GHCR. No push, tag, Actions dispatch or Release operation is authorized by this pasted failure.

Use focused local source-enumeration/process regressions, complete existing release-tool regressions and desktop types/lint/quality. Include root quality only if actual cross-package graph changes justify it; no unrelated full root, SQLite, Rust or installer rebuild is necessary to reproduce this precompile failure. A real current-repository hash snapshot must finish with exact reference parity. Frozen-source review precedes a new concrete local commit plan. Actual four-target packages and tag/draft delivery remain pending; do not archive the task.

## Separate owner-authorized cleanup

The owner subsequently requested removing unnecessary Trellis artifacts and keeping authored Markdown conclusions. That maintenance is independent of the source-list correction: enumeration must remain correct with metadata and eligible source lists larger than 1 MiB. The cleanup does not replace the streaming fix or its large-index regressions. See `trellis-cleanup-conclusion.md` and the task-artifact retention guide.
