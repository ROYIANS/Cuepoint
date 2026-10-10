# Independent protocol review plan

The child is an approved protocol foundation, not a full-workspace codec or real service. Review actual product bodies and adversarial boundary paths, not only green implementation tests.

## Required provenance

Freeze authored sources/tests and new spec hashes; keep generated route formatting proof separate. Root and the implementation agent own product repairs. The checker owns independent probes/report only. Do not stop the user-owned WebStorm dev service. Report exact partial format and use disposable data only.

## Focused risks and observations

| Boundary | Probe / expected outcome |
| --- | --- |
| Canonical manifest | Reorder unordered logical entries, including distinct Unicode/NFC/NFD IDs; locale-independent exact ordering and deterministic identity for equivalents, changed identity for distinct content |
| Strict partial coverage | Unknown version/format/extra nested keys, raw connector/job/approval envelope, fake full coverage: reject before application |
| Stable identity | Reject browser-local, malformed IDs/hashes, duplicates and foreign workspace; provider download must bind manifest to the requested workspace/revision (a self-consistent different revision is not sufficient); preserve fixture entity/revision IDs without remapping |
| Owned path/reference closure | Re-derive path from workspace/project/media; reject safe-looking wrong media/owner path, traversal, missing references and incompatible project owner (Studio exception only if explicit) |
| Actual bytes | Corrupt/truncated/missing/failed read or false size/hash: no application callback; bounded slices/macrotask cancellation without a second full-file synchronous hash; prepared representation immune to caller/provider object mutation |
| Provider capabilities/lifecycle | No conditional-head capability means no silent last-write-wins fallback; unsupported/read-only/limit/auth failure preserves prepared local data; caller progress closure is rechecked at the actual commit boundary |
| Immutable storage and CAS | Same immutable identity cannot change content; concurrent expected-head updates produce one winner, preserve both candidate versions and expose current head |
| Ancestry/base | Expected head must be compatible with candidate parents; snapshot options before awaits so ancestry validation and CAS use the same base; initial null-head rules explicit; do not claim a full graph proof without loading it |
| Publication outcome | Provider acknowledgement distinct from application receipt; runtime CAS shape/identity is valid rather than merely truthy; check signal/error after a committed CAS cannot falsely say nothing was published |
| Application port | Verify all required bytes/refs before calling trusted atomic apply; repeated and concurrent delivery do not duplicate rows; cancellation before commit versus actual commit outcome is distinguished |
| Restart/failure | Test-port prior state/ledger survive failure; recreating fixture device with the same ledger is a logical restart, not an OS/SQLite crash proof |
| Trust statements | A narrow internal interface is not a sandbox for arbitrary third-party JavaScript; SHA-256 integrity is not transport authentication or encryption; allowlisted user text/asset contents are not a universal secrecy guarantee |

## Gates and honest limits

Coordinator ruling: a stale expected head must not short-circuit publication before the complete validated candidate has been stored under immutable keys. Both stale preflight and CAS-race conflicts retain the candidate manifest and referenced object versions for inspection. This staging is not an acknowledgement of head advancement or device application; failure or cancellation retains the local prepared candidate. Capability, lifecycle, ancestry and binary validation precede remote mutations.

Run independent strict app/test type checks and affected regression tests against the final repaired source; reuse matching full-suite/build/serial quality evidence only after checking source provenance. Actual codec families, native filesystem containment/durability, SQLite migration and production service remain unimplemented gates. No fixture result is a user-facing synchronization feature.
