# C01 spec contract draft (append only after independent check)

## 1. Scope / Trigger
Apply to picture/video current generation sources in task records, source inventories and task wrap-up. Historical ledgers establish original effects; current deliverability requires current local evidence.

## 2. Signatures
`inspectTaskGenerationOutput(job)` reads current media and legal target slot without network/decoding. `ownedTaskGenerationJob(task,job)` verifies task/run/batch ownership. `taskGenerationToolSource(task,call)` combines original call success/provenance with current output. Their native promises are adopted with `Promise.resolve` by Dexie transaction callers.

## 3. Contracts
Available files require matching job/target/result kind and owner, downloaded/applied/conflict lifecycle, nonempty Blob and image/video MIME subtype. Applied additionally requires current project, owned entity, valid asset slot or shot/episode/media-kind slot, and matching result ID/kind. Legitimate downloaded files survive target deletion/replacement as independent file facts, never fabricated current application. Preserve source inventory batch-only behavior and immutable call/job history.

Tool sources require completed supported generation tool, successful original result, exact saved job/output IDs and original submit/query/apply provenance; submit requires both its original call ID and original run ID, while later owned runs may query the existing job. Failed/rejected/unknown/pending calls, arbitrary tools mentioning jobId, failed remote results and conflicts cannot become successful tool effects because an older independent file exists. AI result writes and wrap-up publication validate current sources; ordinary completed non-generation writes remain historical business facts. Fingerprints include eligibility changes.

## 4. Validation / Error Matrix
| Input | Required outcome |
| --- | --- |
| Missing/empty/foreign/wrong-MIME/wrong-kind media or illegal job lifecycle | No current deliverable support; AI result rejected |
| Valid file with deleted/replaced/invalid target | Downloaded file fact; applied=false |
| Failed/rejected/unknown/non-generation tool associated with valid old file | Tool not upgraded; independent generation may remain |
| Completed successful generation with mismatched job/output/provenance | Reject tool source |
| Media/owner/application changes after review | Wrap-up stale |
| Historical ordinary committed write | Preserve original fact |

## 5. Good / Base / Bad Cases
Good: a valid file is offered as downloaded while current application is independently reported. Base: rejected later queries remain rejected without hiding a valid independent file. Bad: existence of a media row or historical success JSON proves a current result.

## 6. Tests Required
Actual record-write, source inventory, wrap-up schema/publication and freshness regressions cover image/video owner/Blob/MIME/lifecycle/slot failures and call states, assert ledger history unchanged. Native Chromium/IndexedDB regression uses many repeated/missing locators and actual publication. Structured fake media proves metadata/ownership eligibility, not decoding, playback or creative quality.

## 7. Wrong vs Correct
Wrong: overwrite every call mentioning jobId with the job's current downloaded outcome. Correct: independently validate original successful tool provenance and current owned output, keeping generation evidence separate.
