# Image discovery retrospective

## Confirmed gap
Native image transport already existed, but natural-language requests could not reliably reach it. Generated slot outputs were absent from registered-reference search. Unbound conversations filtered out all reference tools, and transport accepted only bound project input. Fixing only tool instructions would leave these application-level gaps intact.

## Boundary choice
A dedicated local discovery result supplies project/entity/slot/source identities. An exclusive discovered-reader input derives media from the completed same-run tool ledger, then the transport validates the completed reader and current source again. The exception is narrow and code-owned; ordinary unbound documents, project memory and mutation do not inherit it. No project rebinding is needed.

## Visual evidence
Filename, prompt and metadata remain insufficient evidence of image contents. Native acceptance uses exact canvas bytes and checks the actual next Chat/Responses request. A mocked answer alone could falsely pass without a working image pipeline; byte equality makes that regression observable. Combined tests similarly check both image bytes and extracted web text.

## Source identity and lifecycle
Association changes can invalidate an image even when the old media bytes still exist. Compare the current source locator/revision and image identity, and compare digest for same-ID byte replacement. Do this around asynchronous encoding. Independent review reproduced a gap when a slot changes during the final digest read: re-resolve the source again after that digest. The regression failed before the fix and passes afterward. Discovery validation happens before a read is complete; completed-reader proof belongs to request materialization, avoiding a circular precondition.

## Presentation finding
Blank default episode titles are valid stored data. Source labels must reuse episodeLabel so different episodes remain visible, rather than concatenating raw title strings. Native keyboard navigation confirms the source opens the right shot target, not just a plausible URL.

## Limits
Deterministic intercepted model responses prove the tool-to-pixel workflow, not every real model's instruction-following ability. Authenticated web quality remains a separate user-configured service check. No hidden model or backend was introduced to obscure these limits.
