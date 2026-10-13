# Third-party notices

Cuepoint's original code is licensed under the root MIT LICENSE. That license
does not replace the licenses of third-party source, datasets, assets or packages.

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
