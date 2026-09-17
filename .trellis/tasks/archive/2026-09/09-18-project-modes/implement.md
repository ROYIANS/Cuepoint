# Implementation Plan — 单片与连载项目模式

1. Extend project types, constructors, normalizers, update APIs, and package parsing with mode.
2. Add project-type selection to the create dialog, defaulting to film.
3. Route film project entry to its only episode; keep series entry on episode list.
4. Adapt workspace chrome and world navigation for film without breaking series.
5. Add compatibility tests for missing mode and package round-trip.
6. Run tests, lint, build, and manual navigation checks.
