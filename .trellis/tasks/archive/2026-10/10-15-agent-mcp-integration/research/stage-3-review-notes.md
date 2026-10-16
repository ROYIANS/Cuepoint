# Stage 3 Agent integration review

Status: findings resolved and independent frozen-scope review passed after
Stage 2 checkpoint 9d2d2de6. Executed evidence lives in Stage 3 results.

## Original certainty and production reachability

An unknown external effect may retain readable evidence, but returning its
descriptor normally would let core mark the original call completed. Publish
the descriptor through E07 and raise ToolPendingError. Core then keeps the call
unknown and blocks automatic replay.

The initial adapter could read an original invocation a second time only by
calling tool.execute on the same factory. That was not a production recovery
entry: core and resume correctly refuse an unknown call, and the factory ends
with executeChatRun. The correction keeps the finite original host
receipt in foreground memory and exposes a readback-only report action. It
queries invocationStatus and uses the original E07 publication; it never calls
execute/invoke again or saves the grant into product data. Reload cannot invent
the lost in-memory authority. A real core unknown-to-later-known fixture now
passes separately from directly exercising the adapter twice.

Known original completion may settle its surviving original job/call even after
Stop, run interruption or connection retirement. It must not require today's
generation after the result is established. Exact original binding, revisions,
thread/project and non-cleared output remain mandatory; deletion wins.

## Admission, preparation and final claim

Preview and admission use the same pure connection capture and final composed
tool surface. Network/host work stays outside ProductStore transactions. The
existing transitionToolCall transaction must declare deviceSettings because
MCP final claim reads the actual public catalogue. Production-loop regression
reached this boundary and caught the missing declaration.

Place frozenProjectScope reads before the final registry/catalogue/current-owner
check. Local generation fencing and ProductStore awaits are not one cross-system
transaction; the native host independently fences the final effect dispatch.
Save explicit bindings in round rows and claim fingerprints, including pending
approval/resume. A resumed approved exact generation may prepare new ephemeral
authority; a replacement generation cannot inherit the approval.

Reuse preview authority for immediate execution within one factory. Preparing
again for every call consumes the native finite authority budget unnecessarily;
resuming with a new factory remains an explicit reprepare of the same facts.
Predispatch known failures produce a truthful not-started retained report.
Uncertain admission/start acknowledgements remain barriers rather than infer
that no external work happened.

## Actual tool and result budgets

All actual task, installed-skill, report and resource helpers count toward the
36-tool foundation. Eight connected resource servers add sixteen helpers. The
initial merge partitioned external groups but left some existing creative groups
larger than the new capacity, making listed groups permanently unloadable. The
correction deterministically partitions oversized existing groups too,
preserving ordinary identifiers when they fit and keeping the two-group limit.

Frozen resource listing needs explicit pagination. Returning the full bounded
128-resource catalogue can still exceed core's smaller 65,536-unit result
envelope. Count serialized escaped data as well as plain string lengths; quotes
and backslashes can double JSON size. Pagination must preserve every descriptor
and an explicit continuation rather than silently clip it. Resource reads use
only captured handles; binary or returned links do not authorize another fetch.

## Evidence boundaries

Review uses actual Studio admission/preview/model-request/claim/E07 owners with
the fresh ProductStore and finite controlled host port. Such fixtures do not
reclassify native, browser CORS/popup, installed Windows/Keychain or whole-app
acceptance. Necessary stage checks remain separate from parent epic gates.
