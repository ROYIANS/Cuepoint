# Initial native UI baseline — 2026-10-10

Read-only navigation in the existing local app, 1280×720. These observations cover seven representative screens, not the complete native audit. No fields were edited, no provider requests, imports or project mutations were made. Full route/source coverage is separate research; populated/empty/error/overlay and resize coverage is planned after visual direction is agreed.

| Screen | Current h1 | Font | Size / weight / line height | Screenshot |
| --- | --- | --- | --- | --- |
| Projects | 项目 | Serif | 28px / 400 / 28px | [baseline](./screenshots/projects-before.jpg) |
| MaterialLibrary | 素材库 | Sans | 30px / 600 / 45px | [baseline](./screenshots/materials-before.jpg) |
| IPLibrary | 我的 IP | Serif | 30px / 400 / 39px | [baseline](./screenshots/ips-before.jpg) |
| TaskWorkspace | 让每一个想法，走向完成。 | Sans | 29.44px / 550 / 41.216px | [baseline](./screenshots/tasks-before.jpg) |
| Connectors | 连接 | Serif | 28px / 400 / 28px | [baseline](./screenshots/connectors-before.jpg) |
| VideoStory | 故事 | Sans | 17px / 600 / 25.5px | [baseline](./screenshots/video-story-before.jpg) |
| VideoWorld | 世界 | Sans | 18px / 600 / 28px | [baseline](./screenshots/video-world-before.jpg) |

## Initial findings

- Projects uses LibraryHeader: serif 28px regular, search/sort plus a small primary action aligned with the title; filters then a large cover grid.
- Material Library uses its own heading: sans 30px semibold plus an eyebrow, a larger primary action, followed by underline tabs and a wide full-row search/filter toolbar.
- IP repeats the custom eyebrow/heading family; task workspace instead shows a large promotional sentence as h1 and a breadcrumb with TASKS. Connectors returns to the 28px serif LibraryHeader family.
- Video workspace drops the Studio navigation rail/inset surface and uses its own project toolbar; the measured story/world headings use sans at 17px and 18px, with a smaller hierarchy than the top-level libraries.
- These are source/native presentation differences, not broken business behavior. A shared page header and explicit list/detail/editor/print families would align the hierarchy without forcing identical canvas layouts.
- Current app is dark-only. styles.css light color-scheme applies to print, not an existing switchable theme. Light-theme product work is not presumed from cross-platform desktop preparation.

## Proposed direction awaiting user decision

Prefer retaining the current restrained dark neutrals and existing shadcn controls, unifying UI headings in the existing sans family, using stable title + action + filter regions, a small shared spacing scale, explicit content-width modes and shared state presentations. Keep serif only if the user deliberately chooses an editorial direction, or in actual creative/print document content with a functional reason. Avoid decorative eyebrows/promotional page headlines becoming alternate navigation titles. Editing toolbars may be denser than top-level list headers under named shared modes. No native OS chrome, desktop framework, data store, provider request, new theme or font-download decision is made in this planning step.

Native header crops for comparison: [Projects](./screenshots/projects-header-before.jpg) and [Material Library](./screenshots/materials-header-before.jpg). Full screenshots remain above. These are current UI, not proposed implementation.
