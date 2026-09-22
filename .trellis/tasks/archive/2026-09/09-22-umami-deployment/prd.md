# Existing Umami integration

## Requirements

- Connect Cuepoint to the user's existing Umami service.
- Configure the tracker script URL and website ID through GitHub repository Actions variables.
- Publish configured production images through the existing GHCR workflow.
- Leave Docker Compose and runtime deployment configuration unchanged.
- Disable analytics when configuration is absent and during local development.
- Load the tracker once without blocking application rendering; use Umami's built-in SPA pageviews.
- Do not add business events or send project contents, prompts, or API credentials.

## Acceptance criteria

- Both Actions build paths receive the same public Vite configuration.
- Missing or incomplete configuration injects no tracker.
- A production build with both values loads the configured script with its website ID.
- Local environment examples and deployment documentation explain configuration and rebuilding.
- Typecheck, tests, production build, and Compose validation are run; environment limitations are recorded.
