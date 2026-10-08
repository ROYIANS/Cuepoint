# C03 independent acceptance

Refresh actual repo creation transaction scopes and video ZIP parser before reviewing. Assert same rw transaction verifies nonstudio parent before write and touch, delayed completion after delete cannot recreate asset/media. STUDIO_LIBRARY_ID remains valid. Confirm project touch failure atomically rolls back creation; no separate detachedPromise/catch swallowing failure.

Modern nonempty episodes JSON validate original raw shot episode references before parse repair/remap; required valid episode link and optional beat in same episode, no first-episode fallback. Duplicate episode/shot IDs and within-episode beat IDs reject; same beat ID in distinct episode scopes may be valid. Legacy absent or empty episodes keeps historical synthesize-first-episode mapping. Audio/music do not gain video records. Extra/unknown optional fields preserved. Invalid modern links/import identity reject before writes or rollback zero new rows/media. Genuine ZIP scenarios, not direct helper-only assertions.

Source/test beforeafter allchanged; previously reviewed C01/C02 file hashes mustmatch unless needed actualintegrationchanges attributablelatestunit. Typecheck/focusedtests and changedstatic signatures no new diagnostics/suppressions. Parent finding AR04/D01 etc stillpending. NootherCunits/commit/specledger bychecker.
