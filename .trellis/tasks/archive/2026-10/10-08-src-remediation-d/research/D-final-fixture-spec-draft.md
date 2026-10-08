# Draft: durable regression fixture ownership

Apply after focused acceptance; final batch review still required.

## 1. Scope / Trigger
Use this rule when a permanent regression compares current behavior with immutable original code captured during a task. Archiving task records must not remove test inputs or make tests write into archived directories.

## 2. Signatures / Owners
Permanent tests consume the minimal required original module closure under `tests/fixtures/sourceSnapshots/{d05,d06,d07}`. Preserve snapshot bytes and relative import hierarchy, with original-path/hash provenance. Task research/reviews remain immutable evidence, not runtime test dependencies.

## 3. Contracts / Invariants
Copy needed modules; do not move or edit historical evidence. Resolve relative imports within each snapshot closure. Existing alias imports and intentionally shared untouched dependencies retain their original comparator semantics. Tests remain read-only with respect to task reports. Remove a redundant report write only while keeping its behavioral assertions. Original-versus-current comparison must still execute real parsers/adapters, not canned expected outputs.

## 4. Validation / Error Matrix
| Condition | Required behavior |
| --- | --- |
| Active task folder unavailable after archive | Permanent regression still resolves and executes |
| Missing transitive snapshot import | Fail fixture completeness proof/test |
| Snapshot byte differs from recorded original | Fail provenance proof |
| Test writes task report | Remove side effect, retain asserted behavior |

## 5. Good / Base / Bad Cases
Base: stable test fixture imports with original bytes. Good: archive-unavailable execution verifies all affected comparisons. Bad: a permanent test imports an active dated task folder, rewrites accepted evidence, or relies on an assertion-free report generator.

## 6. Tests Required
Run affected original/current behavioral comparisons and demonstrate execution/resolution with the active task directory unavailable in an isolated environment. Verify the minimal relative import closure and original byte hashes; retain any failed attempt and state finite limits.

## 7. Migration / Limits
This correction preserves comparison semantics and evidence while making test inputs durable. It does not claim snapshot source satisfies current production rules, replace current production owners, or close E/QG01 debt. Archived native research scripts are historical evidence unless separately adopted as stable regression entry points.
