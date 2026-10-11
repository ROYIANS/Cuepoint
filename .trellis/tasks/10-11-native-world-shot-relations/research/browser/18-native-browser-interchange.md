# Actual native-to-browser ZIP interchange acceptance

Verified on 2026-10-11 through the isolated browser origin `http://127.0.0.1:5176`. The existing isolated browser store retained its two earlier `浏览器隔离回归` projects. No connection was configured and no provider request was triggered during this check.

## Input and method

- Actual native system-save artifact: `research/packaged/15-native-review.zip`, 6,453 bytes, SHA-256 `afa1d27419406ba04102014cbbb737cd3b1e3bad9544404130a72844ad05229c`.
- The archive contains thirteen JSON records and passes the ZIP CRC check. It contains no private microphone recording or credential record.
- Opened a new background IAB tab at the same isolated origin because no existing tab was available to this worker. The first attempt preceded server startup and showed connection refused; it provides no product-failure evidence. After starting Vite on 5176, the supported browser DOM surface worked. The subagent surface rejects an explicit `visible` option, so no visibility change was requested on the successful tab.
- Used the actual sidebar **导入项目** control and its documented `filechooser.setFiles` flow. Import automatically opened the new project's story workspace. No page-state injection, IndexedDB access, hidden JavaScript, IPC or native-window operation was used.

## Observed result

| Item | Actual UI evidence |
|---|---|
| New project ID | `prj_2f918e69-ed1e-42fe-9d50-816f062abf30`, differs from native `prj_30ac21cd-bea0-43de-a527-dade2cc63e8b` |
| New episode ID | `ep_dbc9c17d-23ac-4e52-80b1-d0d552279d4f`, differs from native `ep_f79a0f69-c940-4d9e-91ca-5c075dab4ca4` |
| Project title | `桌面真实 Agent 验收` |
| Story | Exact marker `NATIVE-PRODUCT-20261011`, Chinese body and original line breaks remain after reload |
| Story beat | One `雨夜抵达车站` beat, character `小光点验收` checked, scene `蓝色车站`, time of day `雨夜` |
| World entities | One character, one scene, one prop, one style |
| Shot | One shot, total duration three seconds, original Chinese content |
| Shot relations | `小光点验收`, `蓝色车站`, checked `红色雨伞`, explicitly selected `暖色写实` |
| Persistence | Reloaded both shots and story; re-opened the shot setting dialog after reload and verified prop/style remained selected |

The source archive does not define a project default style. The shot explicitly selects `暖色写实`; this check therefore claims preservation of that explicit shot relation, not a project-default-style test.

## Evidence

- `14-before-native-zip-import.dom.txt` and `.png`: existing isolated catalogue before import.
- `15-native-zip-imported-story.dom.txt` and `.png`: actual import result, new project and episode IDs, native story marker and beat links.
- `16-native-zip-world-counts.dom.txt`, `16-native-zip-world-style.dom.txt`: four entity counts and new style entity route.
- `17-native-zip-shot-relations.dom.txt`, `17-native-zip-shot-props-style.dom.txt` and `.png`: actual shot and all four relations.
- `18-native-zip-shot-reload.dom.txt`, `18-native-zip-props-style-reload.dom.txt`, `18-native-zip-story-reload.dom.txt` and `.png`: reloaded persistence.
- `18-native-browser-interchange-ui-receipt.json`: exact UI values, IDs, archive hash and source freeze verification.

All 81 product paths in `post-warning-final-build-receipt.json` still match their frozen hashes after this browser run. This worker made no product, test or configuration edit. Only new browser evidence files were written.

The worker owns Vite exec session `6467` and its new browser tabs only. It will stop that server and close its successful new tab on completion; neither user origin 5173 nor native app focus was accessed.
