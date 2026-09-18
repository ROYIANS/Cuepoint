# Design — 分镜拖拽排序

Use `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`. Separate sortable contexts for beat headers and shot rows. On drag end, compute next ordered ID list and call existing repo reorder APIs. Register undo with previous ID list. Pointer + Keyboard sensors. Do not remove arrow buttons.
