# Third-party notices

Cuepoint's original code is licensed under the root MIT LICENSE. That license
does not replace the licenses of third-party source, datasets, assets or packages.

## LobeHub Model Bank

- Upstream: https://github.com/lobehub/lobehub
- Copyright (c) 2024/06/17 - current LobeHub LLC. All rights reserved.
- License: [LobeHub Community License](vendor/lobehub/LICENSE), based on Apache 2.0
  with additional conditions. The original license text is retained unchanged.
- Copied source: `vendor/lobehub/model-bank/`, the entire `packages/model-bank`
  directory at revision `ebe586289d55936b738e4dc822dbdd745196b4f3`.
- Derived files: `src/lib/ai/modelBank/models.generated.json` and
  `src/lib/ai/modelBank/lookup.generated.json` retain the upstream licensing;
  conversion to JSON does not relicense the data under MIT.
- Provenance and exact file checksums: [manifest](vendor/lobehub/manifest.json).
- Local adaptation: source files are unchanged; the generated JSON expands source
  constants/computed model records, and a separate adapter selects metadata for
  Cuepoint. Original notices and source are retained in the vendor snapshot.

## Installed dependencies

Packages listed in `package.json` and the lockfile retain their own licenses,
copyright notices and any asset-specific notices distributed with those packages.
The README acknowledges the projects used by Cuepoint. MIT for Cuepoint's original
code is not a claim that every dependency uses MIT. Examples include Dexie,
TypeScript, Class Variance Authority and fake-indexeddb (Apache-2.0), Lucide (ISC),
and JSZip (MIT OR GPL-3.0-or-later). Consult the installed package's license for the
complete terms and retain the applicable notices when redistributing dependencies.

## Document parsers

- PDF.js / `pdfjs-dist` 5.4.530: https://github.com/mozilla/pdf.js — Apache-2.0.
  The browser worker, CMaps and standard fonts are shipped as local dependency assets;
  preserve the notices/licenses distributed in the package when redistributing.
- Mammoth.js 1.12.0: https://github.com/mwilliamson/mammoth.js — BSD-2-Clause.
  Used inside a local browser worker for raw DOCX text extraction.
