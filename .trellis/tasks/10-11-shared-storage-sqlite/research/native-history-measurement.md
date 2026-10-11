# Representative native history measurement

These measurements use the actual disposable Rust/SQLite process through the shared TypeScript adapter. They compare the same2048 synthetic chat-message rows, each approximately8KiB, before and after registered-query limit/count pushdown. They are diagnostics, not packaged WKWebView or user-interface benchmarks.

| Operation | Before: rows hydrated / query pages / query JSON bytes | After: rows hydrated / query pages / query JSON bytes | Before / after elapsed |
| --- | --- | --- | --- |
| `limit(20)` |2048 /293 /17,380,786 |20 /3 /169,710 |about4.56s /52.50ms |
| `first()` |2048 /293 /17,380,786 |1 /1 /8,511 |about4.54s /10.11ms |
| `count()` |2048 /293 /17,380,786 |0 /0 /0 |about4.50s /0.68ms |

Raw logs: `native-history-measure-initial.log` and `native-history-measure-pushdown.log`; reproducible measurement source: `native-history-measure.mjs`. Both runs create and remove a fresh fixture workspace. Seeding took approximately23.5s and27.8s respectively; it is not included in query timing.

The count measurement records zero **row-query** pages/bytes because it uses a native aggregate response. It still sends IPC and receives the count result; the numbers do not claim zero total traffic. The Node heap deltas in the raw logs are not peak memory, native RSS or WKWebView memory. Shared conformance tests separately verify guards, ordering, optional limits, zero-limit and transaction overlay behavior; these timing logs alone do not prove all query semantics. Actual large-file WK playback and final frozen-source gates remain pending.
