# Deferred draft rebase regression

The fixture mounts actual ReactDOM, `TextDraftField`, `useDebouncedDraft` and the current Dexie project writer. It holds the writer's completion **after** a successful `renameProject`, updates IndexedDB to `External newest`, then releases completion. A primitive string and an object memoized by the external name exercise stable external identities. Both must retain `Local edit` while saving and display `External newest` once saved, including after three unrelated parent renders.

`debouncedDraft-before.ts` is an immutable original dependency-only effect implementation. `provenance.json` records its hash. The browser producer's `regression` mode delivers those exact bytes at the actual current module path; it does not alter the test contract or copy React behavior. All imports remain current sources. The same positive assertions fail against that original and pass against current source.

The root Vitest test validates the original snapshot without a browser. Its native case runs when `E07_PLAYWRIGHT_PATH` and `E07_CHROMIUM_PATH` point to available Playwright and Chromium installations. A runtime is never installed by this test. Without those variables, Vitest explicitly marks the native case skipped.

```sh
E07_PLAYWRIGHT_PATH=/absolute/path/to/playwright/index.mjs \
E07_CHROMIUM_PATH=/absolute/path/to/chrome-headless-shell \
E07_DRAFT_REBASE_TEST_OUTPUT_DIR=/absolute/path/to/review-output \
pnpm test tests/e07DraftRebase.test.ts --maxWorkers=1
```

Use the project's authorized pnpm executable. The output variable is optional: successful temporary output is removed by the test, while failing or explicitly requested evidence remains available. The producer can also run directly:

```sh
node scripts/e07-draft-rebase-browser.mjs current
node scripts/e07-draft-rebase-browser.mjs regression
```

Direct `regression` execution intentionally exits 1 with both failed positive assertions; the Vitest red/green case requires that exact failure and then requires current source to pass. A setup timeout, source drift or another failed contract does not count as the expected red result.

Each shape uses a fresh server cache/browser, native IndexedDB and one main document. Server preflight records scan, actual fixture transform, static-import idle and subsequent dependency processing before browser creation. Source captures distinguish current bytes read by Vite from original bytes delivered in regression mode and rehash every loaded source afterwards. Browser assertions retain a ten-second timeout; no paid/external traffic is allowed. Two animation frames bound the settled observation; this is a focused browser contract rather than universal scheduling or device proof.

The fixture and root test have a permanent type-check entry using the application's actual declarations:

```sh
pnpm exec tsc -p tests/fixtures/e07-draft-rebase/tsconfig.json --pretty false
```

The immutable original source is comparison input, not a current fixture typing target.
