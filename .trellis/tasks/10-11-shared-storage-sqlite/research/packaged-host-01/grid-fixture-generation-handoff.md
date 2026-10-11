# Research: Safe 65-card grid input preparation

- Query: Prepare exactly 65 disposable valid PNG inputs for root-owned actual mounted grid acceptance.
- Scope: internal; generator recipe only under the research role's writable task directory.
- Date: 2026-10-12 (Asia/Shanghai).

## Findings

The known existing synthetic image is `desktop/tauri/fixtures/media/image.png`, 177 bytes, SHA-256 `626815c78eaad46cad849732d1598b45b91700ce046c1ee3f4e2444db80aa32a`. Its source/provenance and actual shared material UI are documented in `../packaged-media-fixture-discovery.md`.

`grid-fixture-generator.py` is ready for root to execute:

```sh
python3 /Users/xiaomengdao/WebstormProjects/aifenjing/.trellis/tasks/10-11-shared-storage-sqlite/research/packaged-host-01/grid-fixture-generator.py
```

The recipe validates the exact known source bytes, PNG CRC/IHDR/IDAT/IEND and expected 64×48 RGB scanline size. It creates only `grid-001.png` through `grid-065.png` beneath the explicit ignored directory `desktop/tauri/.acceptance/shared-storage-host-01/grid-import`, with exclusive creation. It rejects symlink targets, unknown files, mismatching existing bytes and an existing manifest. Matching known copies left by an interrupted run can be reused, with counts recorded. The output `grid-fixture-manifest.json` contains all file paths/bytes/hashes, source/copier provenance and honest evidence limits.

No dependencies, compiler, provider, product module, DB, UI or tests are involved. The exact 65 files do not exist as a claim merely because this recipe was written; only a successful root execution and resulting manifest establish their creation.

## Caveats / Not Found

- This research agent's developer scope forbids writes outside `TASK_DIR/research`; it did not execute the recipe or create the ignored external fixture directory. Root owns that authorized execution, actual app import and FD observations.
- Valid PNG copies alone are not actual mounted capability/grid evidence. Root must import them using existing UI, observe more than 64 mounted preview cards, open a detail preview, and record process descriptor behavior.
- No product sources, profiles, user media, app process or database were read or mutated for this handoff.
