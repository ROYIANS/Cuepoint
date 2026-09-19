# Image discovery acceptance matrix

## Native Edge fixture
Owner: main session. Isolated IndexedDB, real runtime, intercepted model and Tavily services. The fixture is not a live model behavior evaluation.

| Acceptance | Evidence to collect |
| --- | --- |
| VA1 | Unbound user-language request, project-references only, discovery/read calls, exact canvas PNG in both Chat and Responses, no attachment or binding mutation |
| VA2 | Bound foreign project discovery fails in native runtime; forged/cross-run read proof covered by focused tests |
| VA3 | Duplicate project names yield ambiguous_project with no candidates in native runtime; repeated shot/slot/source selection covered by focused tests |
| VA4 | Replacement/deletion/withdrawal during encoding, same-run resume, later history compaction and no duplicate pairing covered by transport tests |
| VA5 | Native desktop/390px labels and source navigation; combined web and image requests for both protocols preserve exact pixels and extracted text |

## Scope separation
Discovery provides candidate metadata, never visual descriptions. read_project_image queues a typed source identity; only the following model request contains pixels. Screenshots and audit labels must preserve that distinction. Sources from web_search are snippets; web_read supplies extracted text. Neither web research nor image preparation proves creative task completion.

An unbound read does not imply project binding, automatic project facts/memory, project document access or write permission. Read permission comes from a completed discovery in the same run/thread, resolved again before encoding and after asynchronous Blob reading. Raw mediaId remains available only through the existing bound path.

## Verification limits
No authenticated Tavily POST or paid model request is permitted by this test plan. A simulated model tool sequence verifies application plumbing and byte identity. It does not establish that every real selected model follows the skill consistently or supports the configured API.
