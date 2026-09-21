# Design

## Boundaries
The behavior gap is navigation/discoverability: StudioShell currently promotes four video-specific asset classes, and ProjectGalleryPage assumes video without naming its medium. Change presentation and routes only; retain repository creation and ownership contracts.

## Components
- StudioShell: shared menu config for desktop/mobile; correct activity predicates for /agent/tasks and asset routes. Keep existing mobile chat overlay behavior and import flow.
- Thin studio routes + feature pages: IP placeholder, unified assets hub, settings/help landing. Existing assets have hub return navigation, original routes stay stable.
- A shared project-kind UI catalog defines five labels/descriptions/icons and availability. It is not a persisted domain discriminator in this increment.
- ProjectGalleryPage: all/video filters show existing records; upcoming type filters show an honest informational state. Creation dialog uses the same catalog and guards submission to video only; mode film/series is labeled 视频形式 to avoid confusing it with medium.
- No new UI frameworks; use shadcn primitives, Lucide icons and existing theme. No fake data, empty-button stubs or live external services.

## Compatibility
No Dexie/ZIP/domain migration. Existing bookmarks and data continue working. / remains the chat redirect. Placeholder areas never reach the video create repository. Future schema and agent confirmation designs are separate tasks.

## Verification
Typecheck/build and browser checks across desktop/390px. Verify menu highlights, detail back links, five-kind creation/filtering and an isolated video create/open/rename flow. Do not touch real browser data; use isolated browser fixture.
