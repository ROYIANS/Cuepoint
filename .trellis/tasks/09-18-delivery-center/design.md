# Design — 制作与交付中心

## Delivery Model

Derive an episode delivery view from project, episode, ordered beats/shots, and project assets. Do not persist report rows.

## CSV

Implement dependency-free RFC 4180-style escaping with a UTF-8 BOM for spreadsheet compatibility. Resolve character/scene names at export time. Filename includes project and episode labels.

## Print

Add an episode print route using the same derived rows. CSS `@media print` and `@page { size: A4 landscape; }` remove application chrome and paginate shot cards. Prefer first-frame result, then last-frame result, then an empty visual placeholder.

## Navigation

Missing-item links pass a shot anchor/query to the shot editor, which scrolls and highlights the target row.

## Compatibility

Delivery exports are derived and do not change the project package contract.
