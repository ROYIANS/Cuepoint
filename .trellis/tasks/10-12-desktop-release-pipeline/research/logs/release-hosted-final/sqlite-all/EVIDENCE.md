# Complete compressed evidence

The original `acceptance.json` and `tool-and-table-coverage.json` are retained byte-for-byte in `.json.gz` files. No record was removed or summarized. The shared `../../release-hosted-evidence-compression.json` manifest records original/compressed paths, sizes and SHA256 hashes with a verified exact restore.

Read with Python `json.loads(gzip.decompress(Path(path).read_bytes()))` or decompress to a temporary destination; the gzip files are the original evidence, not compact result substitutes. Individual original command logs and raw per-worker coverage JSONL files remain alongside them. The first failed attempt and final corrected pass have separate directories and outcomes.
