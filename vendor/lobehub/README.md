# LobeHub Model Bank snapshot

`model-bank/` is a byte-for-byte copy of the complete local LobeHub
`packages/model-bank/` directory. No files, fields, comments, tests, model types,
provider variants or disabled entries are filtered or edited. The upstream root
license is retained as `LICENSE`; `manifest.json` records repository revision and
SHA-256 of every package file and the license. This is third-party source under
that license, not a separately published npm dependency.

Source snapshot: `ebe586289d55936b738e4dc822dbdd745196b4f3`.
The file hashes identify actual checkout contents, including any local edits.
A copied date is not an independent verification date for upstream model facts.

The snapshot contains 197 files. Its static model exports contain 85 provider
catalogs, 1,855 provider/model records and 1,399 distinct model IDs. Types include
chat (1,630), image (114), video (88), embedding (12), TTS (3), ASR (3), realtime (5).
The complete package also retains provider configuration, shared parameter schemas,
knowledge-cutoff definitions, utilities and tests. Empty catalogs are retained.

Runtime JSON is derived into `src/lib/ai/modelBank/`; all model object fields are
preserved. Shared constants and computed expressions are evaluated from the copied
source, not manually transcribed. The compact capacity index is separate and does
not replace the full source/data. Application transport policies stay outside it.

Do not edit this snapshot or generated JSON by hand. On-demand commands:

```sh
# Verify local snapshot and generated data; optionally compare the source checkout
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:verify /path/to/lobehub
# Explicitly replace the snapshot from the chosen local checkout and regenerate
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm model-bank:sync /path/to/lobehub
```

There is no scheduled task, automatic upstream pull or runtime network fetch.
Review the full diff, including license changes, then run lint/tests/build.
