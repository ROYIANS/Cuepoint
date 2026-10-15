# E04 owned topic reads and reading navigation

## Scope and authorization

The owner authorized sequential stages and a commit after each one. Prepare the smallest source-backed scope here; activate after E03 is reviewed and committed. Source investigation is in research/query-reading-design.md. No new product decision is needed: per-topic reading-position persistence is excluded from this delivery.

## Read ownership

Keep existing inline ProductStore queries. Messages and runs return `{forThreadId: string | null, messages/runs: []}` from the same readonly query invocation that captured the requested ID. Derive usable rows only when the returned request identity equals the active ID (including null and an observed empty result), retaining row-level thread filtering. An unmatched retained result means undefined/loading, never empty. Scope the topic compaction query identically where it drives current-topic feedback.

Use those owned values for every parent consumer: departure, retry eligibility, project lock, composer attention, task/run state, transcript and inspector. Keep the routed thread lookup, positively created E02 thread bridge, canonical message joining and stable provisional workspace key. Matching messages need not wait for the run query. Do not alter generic ProductStore retention, create a second fetch owner or remount the parent execution/composer to clear cached results.

The departure hook also filters supplied runs by its explicit current thread before deriving blocking/executing. Preserve real running/approval/resumable-tool confirmation, task draft guard ordering and one-use navigation bypass. Returning to the latest message or from an E01 detail is local reading and never calls departure/abort.

## Reading intent

Keep scroll state local to MessageList: authoritative refs, one paused/following boolean updated only on transitions, the existing 300px threshold, instant `scrollTop` assignment and content ResizeObserver. Use an explicit requested thread identity passed through ChatWorkspace instead of inferring it from the first message; E02 reserved thread identity stays stable through canonical observation. New user ID resumes following; replacement of the same reserved user ID does not.

Show one native `返回最新` button only while following is paused, inside the existing positioned navigation shell and above the composer-safe area. Activation clears manual navigation, resumes following, snaps immediately and moves keyboard focus to the message viewport with preventScroll before hiding the button. Native keyboard/touch activation is sufficient; no custom key emulation, live-region notice, toast or unread counter. Rail/activity/disclosure still pause, and paused content growth/resize leaves the reading position alone. No smooth scrolling or per-token parent state.

## Validation and limits

Use actual supplied observer queries with controlled delivery: A-to-B pending, empty A-to-pending B, observed empty B and stale A callbacks. Check parent consumers and the real departure hook rather than only filtering helpers. Exercise actual MessageList DOM with controlled geometry/ResizeObserver: paused growth, button activation/focus, renewed following, same-ID optimistic acknowledgement and explicit thread change. Preserve E02 quiet fallback and E03 Stop/controller ownership. Run only necessary affected tests, direct Studio types, changed-source lint and architecture. Full suites/build/package/native/live acceptance stays at batch completion.
