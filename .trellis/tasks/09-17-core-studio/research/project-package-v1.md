# Project package v1

Format string: `aifenjing-project-v1`

## Zip

```
manifest.json
project.json
characters.json
scenes.json
shots.json
media/<id>.<ext>
```

`manifest.json`: `{ "format": "aifenjing-project-v1", "exportedAt": ISO-8601 }`

Images are never inlined as data URLs. JSON files may contain unknown keys; importer preserves them on `extra`.
