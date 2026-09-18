# APIMart output defaults research

Verified 2026-09-18 against APIMart public documentation. These are provider-specific contracts; do not treat model marketing names as portable API schemas. Reverify at implementation time, since documentation and model capabilities change.

Sources:
- https://docs.apimart.ai/llms.txt
- https://docs.apimart.ai/en/api-reference/images/gpt-image-2/generation
- https://docs.apimart.ai/en/api-reference/images/gpt-image-2/official
- https://docs.apimart.ai/en/api-reference/videos/minimax-h3/generation

## GPT Image 2 standard channel

`gpt-image-2` (alias `gpt-image-2-ext`) submits async images. The standard-channel `size` accepts 15 ratios (1:1, 3:2, 2:3, 4:3, 3:4, 5:4, 4:5, 16:9, 9:16, 2:1, 1:2, 3:1, 1:3, 21:9, 9:21), auto, or explicit dimensions. `resolution` is lowercase `1k`, `2k`, `4k`; `n` is 1. Up to 15 references are documented. The resolution tier is not a fixed width/height: 4k square is documented as 2880×2880 while 16:9 is 3840×2160. Some 1k mappings vary. Do not display one guessed exact size for a tier or copy video resolution values into image requests. Official-channel schema is a separate profile and must be verified separately before adding its UI.

## MiniMax H3

Exact API model ID `MiniMax-H3`. Duration is integer 4–15 seconds, default 5. Resolution enums are uppercase `768P`, `2K` (default). Concrete ratios: 21:9, 16:9, 4:3, 1:1, 3:4, 9:16. In text-to-video, omitted/adaptive ratio falls back to 16:9; in first/last-frame generation it follows the input image and explicit ratio is ignored; reference generation supports adaptive or concrete ratios. A project ratio alone therefore cannot guarantee a generated frame ratio.

First/last-frame roles and reference mode are mutually exclusive. `image_urls` means reference images, never an implicit first/last frame pair. Reference limits: 9 images, 3 videos, 3 audio; audio requires an image or video too. Prompt required in every mode, max 7000 characters. Use URLs; the docs disallow Base64 for H3. Input dimension/duration/format constraints need preflight at actual generation entry. Current connector upload cap can be stricter than model input limits, so consult both. Do not add unsupported H3 values from H3-Max, Hailuo-02 or Hailuo-2.3.

## Product consequences

Separate project creative output target from optional image/video generation defaults. Preserve generic manual project setup without a connector or key. Store provider + model identity, capability/profile revision and modality-specific fields. Map selected ratio to the native `size` or `aspect_ratio` only at adapter/request construction. Model switch must surface unsupported saved values and ask user to choose a supported alternative; never silently coerce or rewrite existing shots/media. For H3 I2V show that the uploaded frame determines ratio and validate mismatch before generation. Keep duration as a per-shot override inheriting the default only where explicitly requested, not as automatic changes to authored timing. No remote generation/paid requests in this task.
