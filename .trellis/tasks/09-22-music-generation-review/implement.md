# Delivery steps
1. Add strict bounded frozen music review snapshots at preparation/persistence.
2. Implement read-only fresh-state checks and version-bound atomic approval using existing guards; retain submit-time check.
3. Render compact responsive review with real wire semantics, full-text disclosure and legacy/stale states; preserve other tools.
4. Test all music modes, long content, ignored fields, stale draft/connector/deletion/race, original provenance and zero paid calls before approved execution.
5. Independent review and full validation; document browser limits and commit cohesive change. This is first R8 delivery; structured vocal intent remains deferred.
