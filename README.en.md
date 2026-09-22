# Cuepoint · 小光点

**A local-first AI creative studio for developing stories, visuals, audio, and music.**

[简体中文](README.md) · **English**

Cuepoint brings a creative assistant, film storyboarding, audio production, music generation, and reusable IP and material libraries into one browser workspace. Work directly in the editors, or ask the assistant to use project references, organize a task, and operate creative tools—then inspect the results saved in the workspace.

Project data lives in the current browser's IndexedDB. AI features use your own service connections and API keys (BYOK). Deploy Cuepoint as a static website or use the supplied Docker image; no Cuepoint application database is required on the server.

> Video, audio, and music projects are available. Standalone image and copywriting workspaces are marked “coming soon”; image generation and text editing within existing video workflows are available. The application UI is primarily Chinese. This English README does not imply a fully localized English UI.

## Contents

- [Features](#features)
- [First steps](#first-steps)
- [Creative workflows](#creative-workflows)
- [AI connections and models](#ai-connections-and-models)
- [Data, privacy, and backups](#data-privacy-and-backups)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Umami analytics](#umami-analytics)
- [Technology and repository structure](#technology-and-repository-structure)
- [Quality checks and contributing](#quality-checks-and-contributing)
- [FAQ](#faq)
- [Documentation and implementation scope](#documentation-and-implementation-scope)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Features

| Area | Implemented capabilities |
| --- | --- |
| Creative assistant | Streaming conversations, project binding, task plans, tool execution, permissions, execution history, and saved outcomes |
| Video projects | Films and series, world settings, stories and scenes, shot lists, asset relationships, visual generation, and production delivery |
| Audio projects | Chapters and manuscripts, speakers and voices, speech generation, microphone recording, source auditions, multitrack editing, and WAV mixdown |
| Music projects | Drafts, Suno / Flow Music generation, playback and favorites, settings reuse, downloads, and adoption into audio projects |
| IP profiles | Multiple persistent creative identities, project relationships, and IP-scoped materials |
| Material library | Images, videos, audio, documents, and character / scene / prop / style settings, with versions and project adoption records |
| Project memory | Reviewed conventions, preferences, decisions, and lessons with version history and provenance |
| References | Local extraction of images, TXT / Markdown, text PDFs, and DOCX for assistant search and reading |
| Web research | Web search and page extraction through a separately configured Tavily connection, with visible sources |
| Delivery and migration | Project ZIP import/export, episode CSV, printable storyboards, production handoff archives, and audio downloads |

## First steps

1. Start the image using [Deployment](#deployment), or launch the development server using [Local development](#local-development).
2. Open **连接与模型** (Connections and models), add a service, enter its Base URL and API key, and test the connection or inspect available models.
3. Create a video, audio, or music project from **项目** (Projects). Projects can stand alone or be linked to a profile under **我的 IP** (My IP).
4. Add your manuscript and materials manually, or open **创作助手** (Creative assistant), choose a chat connection and model, and bind the target project.
5. Review permissions and generation settings when using tools, then inspect saved results in the appropriate workspace.
6. Export project ZIP backups regularly, particularly before moving to another browser, device, or deployment origin.

Local project editing, material management, and supported exports do not require an API key. Chat, AI generation, and web research require the relevant configured services.

## Creative workflows

### Video: story → shots → production → delivery

- **Organize the project:** films use one internal episode; series support multiple episodes sharing project settings and assets.
- **Define the world:** maintain characters, scenes, props, visual styles, and world settings; adopt copies of studio assets into the project.
- **Develop the story:** edit scripts and story scenes, then turn them into specific shots.
- **Edit shots:** manage order, duration, status, prompts, and asset relationships using filters, drag operations, and keyboard actions.
- **Produce visuals:** review the provider, model, prompt, and destination in the assistant's generation flow; inspect candidates and adopt them into shots or assets.
- **Prepare delivery:** inspect missing information and media, then export an episode CSV, printable storyboard, or production material handoff ZIP.

A production handoff archive delivers shots and materials. A project backup ZIP is intended for reimport into Cuepoint. Cuepoint does not currently provide a complete video editing timeline, transition compositor, or automatic full-film renderer.

### Audio: manuscript → voices → tracks → output

- Write chapters and script segments, assign speakers, and split pasted multiline manuscripts into segments.
- Configure MiMo preset voices, natural-language voice design, or reference-based voice cloning. Audition and save reusable speaker configurations.
- Generate narration, import audio, or record with a microphone. Recording requires an explicit user action and browser permission.
- Keep multiple takes, audition them, select the take to use, and place it on the timeline.
- Arrange multiple tracks; move, trim, split, and duplicate clips; adjust gain and fades; inspect the mix using mute and solo.
- Export a chapter or the complete project as WAV. Export history distinguishes older outputs from the current edit state.

New speech defaults to MiMo configuration; existing APIMart speech configurations remain supported. Music works can be explicitly adopted into an audio project as new takes for further editing.

### Music: draft → generated versions → library

- Write descriptions, lyrics, and style settings in drafts. Choose simple, custom, or Flow creation options according to the engine.
- Submit Suno / Flow Music jobs through APIMart and retain provider task identifiers and results.
- Search, audition, favorite, and download works; reuse a work's settings to start another draft.
- Save works to the material library or adopt them into audio projects.

Models, parameters, account permissions, quotas, and charges depend on the provider. Provider completion, successful local download, and human audition are separate steps.

### Assistant: execute in context and inspect outcomes

The assistant can use its bound project, references, and project memory to plan work, read project data, edit creative records, and call enabled generation or research tools. Ordinary conversation and tool execution modes have different capabilities; enabled tools and permissions determine which actions are available.

| Permission mode | Behavior |
| --- | --- |
| 请求批准 — Ask for approval | Asks before editing business data or using internet tools |
| 帮我批准 — Assisted approval | Executes routine operations automatically; asks for high-risk actions and paid generation |
| 完全访问 — Full access | Executes enabled tools autonomously; paid generation still requires configuration review |

Execution history exposes tool calls, pending actions, stop reasons, and actual saved changes. Generation jobs and candidates remain available for inspection, adoption, and further processing. An assistant message saying “done” does not replace checking the workspace's saved results.

Maintain project memory manually or derive reusable knowledge from confirmed task summaries. Documents are parsed locally; selected text or images are sent to the chosen provider when used in an AI request. Scanned PDFs have no OCR guarantee, and image understanding requires a capable selected model.

### IP and material reuse

An IP profile organizes a long-lived creative identity or world; it is not a separate project type. Materials may belong to the studio globally, an IP, or an individual project. Adoption creates project-owned copies and records the adopted version. Publishing a new shared material version does not silently replace settings or visuals already used by projects.

## AI connections and models

Connections are studio-wide, so projects can reuse them. Choose the chat model in the assistant and confirm generation models and parameters in their respective flows.

| Connection | Use in Cuepoint |
| --- | --- |
| OpenAI-compatible | Compatible chat services, proxies, or local gateways |
| DeepSeek | A preset connection for its compatible chat service |
| APIMart | Chat, image/video generation, and audio/music adapters |
| AIHubMix | Chat and image/video generation |
| MiMo | Chat, speech synthesis, voice design, and voice cloning |
| Tavily, configured separately | Assistant web search and page extraction |

Model lists and capability hints combine provider metadata with the bundled Model Bank snapshot. They do not establish account permissions. Public model discovery, authenticated connection tests, and actual generation are distinct operations.

The generic OpenAI-compatible connection test first requests the model list. If the endpoint is unsupported or certain network errors occur, it may fall back to a minimal chat request, which can incur a small amount of provider usage. Dedicated connectors use their own test protocols.

The browser calls providers directly, so those services must allow the necessary cross-origin requests (CORS). Configure your own compatible gateway if a proxy is needed; this repository does not include an application backend proxy. Use HTTPS provider endpoints when the application is served over HTTPS.

## Data, privacy, and backups

### Where data lives

| Data or operation | Storage or destination |
| --- | --- |
| Projects, manuscripts, shots, materials, audio, conversations, tasks, and memory | The current browser's IndexedDB; some UI preferences use local storage |
| AI and search credentials | Stored locally in the current browser; used to authenticate requests to the corresponding service |
| AI conversations, generation descriptions, and selected reference text/images/audio | Sent to configured services when the relevant features are used |
| Web research queries and extraction URLs | Sent to Tavily when research tools run |
| Website resources | Loaded from the deployment; the page also requests Google Fonts |
| Optional analytics | Standard pageview data is sent when Umami is configured in a production build |

“Local-first” describes project storage. It does not mean every feature works offline, and browser storage is not an operating-system keychain. There is no built-in account service, automatic cross-device sync, or real-time collaborative backend.

Browser profiles and origins isolate data. Changing the domain, scheme, or port, switching browsers, using private browsing, or clearing site data can make existing projects inaccessible or remove them. Server containers and volumes do not back up visitors' browser databases.

### Project ZIP coverage

Export from a project's menu and restore using **导入项目** (Import project) in the studio sidebar. The package identifier remains `aifenjing-project-v1` for compatibility with existing backups.

| Included | Not included |
| --- | --- |
| Project settings, video episodes and shots, project-owned characters/scenes/props/styles | AI connections, API keys, and Tavily credentials |
| Referenced and retained project media, references, and extracted text chunks | Complete Agent conversations, execution ledgers, and task history |
| Project memory and its version history | All studio IP profiles and the complete shared material library |
| Audio/music project records and related media | Studio material snapshots that have not been adopted into the project |

Import creates independent project and resource IDs. Imported memories require review, and historical generation jobs do not automatically resubmit paid requests. A project ZIP is a project backup and migration format, not a complete image of the browser's studio.

## Local development

### Prerequisites

Use **Node.js 22**, matching CI. Follow the `packageManager` entry in [`package.json`](package.json), currently **pnpm 10.15.0**. In an existing workspace, also follow [`AGENTS.md`](AGENTS.md) and machine-specific package-manager instructions to avoid rebuilding dependencies with an incompatible version.

```bash
git clone https://github.com/ROYIANS/Cuepoint.git
cd Cuepoint
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. Basic startup requires no `.env` file, database, Redis, or server-side AI credentials.

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Produce static production files in `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | Run `tsc -b` for TypeScript checking |
| `pnpm test` | Run the complete Vitest suite |
| `pnpm exec vitest run tests/umami.test.ts` | Run one test file |
| `pnpm model-bank:verify` | Verify model snapshots and generated data |
| `pnpm model-bank:compare` | Currently an alias for snapshot verification |
| `pnpm model-bank:sync /path/to/lobehub` | Sync the snapshot from a local LobeHub checkout and generate data; review changes and licenses |

## Deployment

### Docker Compose

Image: `ghcr.io/royians/cuepoint`. See the [GHCR package](https://github.com/ROYIANS/Cuepoint/pkgs/container/cuepoint). Obtain [`docker-compose.yml`](docker-compose.yml) from this repository and run these commands from its directory:

```bash
# Login is only needed if the image package is private.
printf '%s' "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

docker compose pull
docker compose up -d
```

Open `http://localhost:8080`. Compose maps host port `8080` to Nginx port `80` and uses the `unless-stopped` restart policy. For public HTTPS access, place a TLS reverse proxy in front of the site. Recording requires HTTPS or a local secure context.

Update with `docker compose pull` and `docker compose up -d`. To pin a release, replace `latest` in Compose with an available version tag.

### Build the image locally

```bash
docker build -t ghcr.io/royians/cuepoint:latest .
docker compose up -d
```

The Dockerfile installs locked dependencies and builds the frontend in a Node stage, then copies `dist/` into Nginx. The runtime needs neither Node nor an application database. Project data is not stored in the container.

### Static hosting

Run `pnpm build` and deploy `dist/`. Configure an SPA fallback to `index.html` when a requested file does not exist; otherwise, opening or refreshing a project detail URL will return 404. Current routes and assets assume deployment at the site root. Hosting under a subdirectory requires additional configuration and verification.

[`deploy/nginx.conf`](deploy/nginx.conf) includes route fallback, gzip, asset caching, and HTML revalidation. `pnpm preview` is for local verification; use a production static server or hosting platform for deployment.

### GitHub Actions publication

The [workflow](.github/workflows/ghcr.yml) runs on pushes to `main`, `v*` tags, pull requests targeting `main`, and manual dispatch. Its quality job installs locked dependencies, checks types, runs tests, verifies the model snapshot, and builds production assets. Image publication depends on that job succeeding. Pull requests do not publish images.

The default branch publishes `latest`, version tags produce semver tags, and images also receive a commit SHA tag. The publication job uses `GITHUB_TOKEN` with `packages: write`; repository or organization policy must allow that permission.

When publishing from a fork, update the fixed image name in the workflow and the corresponding Compose and local-build tags.

## Umami analytics

Connect an existing Umami instance. No analytics service or runtime environment configuration needs to be added to Compose.

### GitHub configuration

Open **Repository → Settings → Secrets and variables → Actions → Variables** and add two repository variables:

| Variable | Value |
| --- | --- |
| `VITE_UMAMI_SCRIPT_URL` | The full tracker `src`, such as `https://analytics.example.com/script.js` |
| `VITE_UMAMI_WEBSITE_ID` | The `data-website-id` from the same tracking code |

Both are required. The script must have an absolute HTTP(S) URL; use HTTPS for an HTTPS website. These values are public and embedded in the frontend. Use Variables, and do not enter an administrator password or API token.

After saving, run **Actions → Quality checks and GHCR image → Run workflow** on `main`, or push a new commit. Wait for publication, then pull the image and recreate the container.

These settings take effect at **build time**. Changing GitHub variables or adding environment variables to an existing container does not alter an old image. To disable analytics, clear either value, rebuild/publish, and redeploy.

### Local builds and verification

Copy [`.env.example`](.env.example) to `.env.local`, fill both values, then run `pnpm build` and `pnpm preview`. `pnpm dev` does not load analytics.

Local environment files are excluded from Git and Docker contexts. Pass local Docker build settings explicitly:

```bash
docker build \
  --build-arg VITE_UMAMI_SCRIPT_URL=https://analytics.example.com/script.js \
  --build-arg VITE_UMAMI_WEBSITE_ID=YOUR_WEBSITE_ID \
  -t ghcr.io/royians/cuepoint:latest .
docker compose up -d
```

The tracker loads asynchronously once and handles SPA navigation. This integration adds no business events and does not explicitly attach project contents, prompts, or provider credentials. Standard pageview metadata still includes the URL, title, and referrer.

After deployment, inspect the browser's Network panel for the script and collection requests, normally `/api/send`, while navigating. Confirm visits under the matching website in Umami. Content blockers may prevent tracking. See the [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration) and [SPA guide](https://docs.umami.is/docs/guides/track-single-page-apps).

## Technology and repository structure

| Layer | Technologies and responsibilities |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7 |
| Routing | TanStack Router file routes and automatic code splitting |
| Local data | Dexie / IndexedDB and reactive `dexie-react-hooks` queries |
| UI | Tailwind CSS 4, Radix UI, Ant Design, Lobe UI, Lucide, Motion |
| AI | Browser-side provider adapters, Agent tools/runtime, Model Bank metadata |
| Documents and media | PDF.js, Mammoth, JSZip, Web Audio, MediaRecorder |
| Verification and deployment | Vitest, fake-indexeddb, TypeScript, GitHub Actions, Docker / Nginx |

```text
src/
├── routes/                 # Studio and project file routes
├── components/
│   ├── studio/             # Navigation, projects, IP, materials, connections
│   ├── agent/              # Chat, tasks, references, execution, outcomes
│   ├── story/ & shots/     # Story and shot editors
│   ├── assets/ & produce/  # Creative assets, production checks, delivery
│   ├── audio/ & music/     # Audio and music workspaces
│   ├── memory/             # Project memory management
│   └── ui/                 # Shared UI components
├── db/                     # Database versions, repositories, transactions
├── domain/                 # Project, Agent, audio, music types and rules
└── lib/
    ├── ai/                 # Model catalog, protocols, provider clients
    ├── agent/              # Tools, context, execution, generation
    ├── audio/              # Recording, playback, editing, mixdown, WAV
    ├── audioGeneration/    # Audio/music generation runtime
    └── references/         # Reference import, extraction, packaging
public/brand/               # Product identity and icons
tests/                      # Unit, repository, and runtime tests
vendor/lobehub/             # Upstream Model Bank snapshot and license
scripts/                    # Model snapshot maintenance
deploy/                     # Nginx configuration
.github/workflows/          # Quality gate and image publication
docs/                       # Product and architecture planning
.trellis/                   # Development specs, tasks, session records
```

## Quality checks and contributing

Read [`AGENTS.md`](AGENTS.md) and the relevant [Trellis development guidelines](.trellis/spec/frontend/index.md) before making changes. Persist project data through repositories and transactions in `src/db/`. Preserve project ownership, revision conflict checks, and import/export compatibility.

Validate changes according to their scope. The complete release gate is:

```bash
pnpm lint
pnpm test
pnpm model-bank:verify
pnpm build
```

`lint` currently means type checking, not ESLint. Tests emphasize pure logic, repositories, and runtimes. Recording, browser CORS, actual model quality, and paid generation need separate real-environment verification. Distinguish mocked tests from live-provider validation in change descriptions, and preserve third-party licenses and snapshot provenance.

## FAQ

**Why did my projects disappear after changing the address?**

Browser storage is origin-scoped. `http://localhost:8080` and a production HTTPS domain use different databases. Export project ZIPs from the original address and import them at the new one.

**Does the assistant keep working after I close the page?**

Browser-based multistep execution does not continue as a background service. Asynchronous jobs already submitted to a provider may continue remotely. Reopening can allow querying or recovery using saved task records. Stopping local waiting does not cancel remote generation or charges.

**Why does a connection fail even with an API key?**

Check the Base URL, model access, balance, HTTPS, and CORS. Public model discovery does not establish key validity. There is no built-in proxy; the provider must permit browser requests, or you must configure your own compatible gateway.

**Why can't I create image or copywriting projects?**

Those standalone workspaces are not open yet. Image generation, script editing, and prompt editing in video workflows remain available.

**Why is microphone recording unavailable?**

Check HTTPS or localhost access, MediaRecorder support, microphone permission, and device availability.

**Can a project ZIP restore the entire studio?**

No. It excludes full conversation history, global connections, all IP profiles, and the complete material library. See [Project ZIP coverage](#project-zip-coverage).

**Why did changing Umami variables not enable tracking?**

Rebuild and redeploy the image, supply both values, and use a production build. Also check blocking extensions, HTTPS consistency, and the website selected in Umami.

## Documentation and implementation scope

- [Product and architecture index](docs/README.md): includes early planning notes, not all of which describe implemented functionality.
- [AI connector design](docs/product/ai-connectors.md): connection and protocol adapter background.
- [Film Agent workflow](docs/product/film-agent-workflow.md): task and workflow design.
- [Runtime options](docs/architecture/runtime-options.md): discussion of static Web, optional proxies, desktop, and synchronization.
- [Frontend guidelines](.trellis/spec/frontend/index.md): conventions and module contracts.
- [Third-party notices](THIRD_PARTY_NOTICES.md): dependency, snapshot, and document-parser licensing.

The current delivery is a static browser application. A desktop shell, native MCP integration, server-hosted background Agent, automatic cross-device sync, and real-time collaboration are not implemented capabilities. Treat current code and working UI as authoritative.

## Acknowledgments

Cuepoint builds on the work of these projects and their contributors:

| Project | Role |
| --- | --- |
| [PDF.js](https://github.com/mozilla/pdf.js), [Mammoth.js](https://github.com/mwilliamson/mammoth.js) | Local PDF and DOCX text extraction; Apache-2.0 and BSD-2-Clause respectively |
| [LobeHub](https://github.com/lobehub/lobehub) | Model Bank source; references for Agent chat and interaction patterns. Snapshot and license retained in [`vendor/lobehub`](vendor/lobehub/README.md) |
| [Lobe UI](https://github.com/lobehub/lobe-ui), [Lobe Icons](https://github.com/lobehub/lobe-icons), [Fluent Emoji](https://github.com/lobehub/fluent-emoji) | Chat components, model branding, and emoji resources |
| [React](https://react.dev/), [TypeScript](https://github.com/microsoft/TypeScript) | Application UI and type system |
| [Vite](https://github.com/vitejs/vite), [Vite React Plugin](https://github.com/vitejs/vite-plugin-react) | Development server and builds |
| [TanStack Router](https://github.com/TanStack/router) | Typed routing and route generation |
| [Dexie](https://github.com/dexie/Dexie.js) | IndexedDB access and reactive data |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss), [tailwind-merge](https://github.com/dcastil/tailwind-merge), [tw-animate-css](https://github.com/Wombosvideo/tw-animate-css) | Styling, class merging, and animation utilities |
| [Radix Primitives](https://github.com/radix-ui/primitives), [Ant Design](https://github.com/ant-design/ant-design) | Dialogs, overlays, forms, and UI primitives |
| [dnd kit](https://github.com/clauderic/dnd-kit) | Drag and drop |
| [Lucide](https://github.com/lucide-icons/lucide), [Boring Avatars](https://github.com/boringdesigners/boring-avatars) | Icons and avatars |
| [Motion](https://github.com/motiondivision/motion), [Sonner](https://github.com/emilkowalski/sonner) | Animation and notifications |
| [Class Variance Authority](https://github.com/joe-bell/cva), [clsx](https://github.com/lukeed/clsx) | Component variants and conditional classes |
| [Zod](https://github.com/colinhacks/zod), [JSZip](https://github.com/Stuk/jszip) | Validation and project ZIP archives |
| [Trellis](https://github.com/mindfold-ai/Trellis) | Development guidelines and task workflow |
| [Vitest](https://github.com/vitest-dev/vitest), [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB), [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | Tests, browser database simulation, and type declarations |

Thanks also to [APIMart](https://docs.apimart.ai/llms.txt) and [AIHubMix](https://docs.aihubmix.com/llms.txt) for the API documentation used in connector implementation.

See [`package.json`](package.json) and the lockfile for dependency versions. Each project retains its copyrights and license; acknowledgment does not relicense third-party content.

## License

Cuepoint's original code is licensed under the [MIT License](LICENSE).

Third-party content remains under its original terms; see [Third-party notices](THIRD_PARTY_NOTICES.md). The imported LobeHub Model Bank source and derived data remain under the [LobeHub Community License](vendor/lobehub/LICENSE) and are outside Cuepoint's MIT grant.
