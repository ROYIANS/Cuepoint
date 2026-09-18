# LobeHub context sources and composer surfaces

Inspected local checkout: /Users/xiaomengdao/WebstormProjects/lobehub, 2026-09-19. These findings describe the supplied checkout, not an assertion that app.lobehub.com deploys the identical revision.

## Capacity, pricing, and usage are separate

- packages/model-bank/package.json names a private workspace package, model-bank. This is source-maintained metadata, not a newly fetched public npm model catalog.
- packages/model-bank/src/aiModels/openai.ts defines GPT-5.6 Luna: contextWindowTokens = 1,050,000, maxOutput = 128,000. Its pricing.units contains tiered entries split at 272,000 input tokens. That threshold controls pricing, not a second context window.
- packages/business/model-bank/src/model-config.ts wraps loadModels from model-bank; the inspected open-source business wrapper returns an empty proprietary LobeHub catalog. Private deployment catalog values cannot be inferred from this wrapper.
- packages/model-runtime/src/utils/modelParse.ts resolves a provider-specific known model, then an exact model ID from the bank. processModelCard uses model.contextWindowTokens ?? knownModel.contextWindowTokens. It merges advertised limits with source-maintained fallback specifications.
- packages/model-runtime/src/providers/aihubmix/index.ts fetches the configured gateway root + /api/v1/models, maps context_length → contextWindowTokens and max_output → maxOutput, then processes the catalog. This is also the endpoint used by our AIHubMix connector. Changing endpoints is not the missing tier solution.
- src/store/aiInfra/slices/aiModel/selectors.ts exposes the enabled model's contextWindowTokens; src/hooks/useModelContextWindowTokens.ts reads it for the inspector.
- The composer inspector has its own estimation path: src/features/ChatInput/ActionBar/Token/useTokenBreakdown.ts → src/hooks/useTokenCount.ts → packages/utils/src/tokenizer/index.ts → tokenx. It estimates assistant prompt, tools/prompts, history summary, sliced conversation text and draft. It does not obtain used tokens from /models.
- The runtime packages/context-engine/src/tokenAccounting path is separate and richer: it accounts tool calls/results, reasoning, signatures and available provider output counts. Do not conflate that path with the simpler composer popup.
- A model limit from a gateway, a manufacturer reference limit, a user-selected working budget, an output allowance and a price tier must remain distinct. We do not infer available account entitlements from a maximum catalog value, and do not substitute 272K for a 1.05M capacity.

## Local correction

Our previous reference lookup was coupled to getReasoningPolicy(connector, model), so APIMart could lose a known reference capacity merely because its reasoning contract was unsupported. getModelContextReference now resolves exact verified model IDs independently. Provider capacity still takes precedence; reference capacity is explicitly labeled. No alias guessing or invented price data. Model details also show max output when the provider supplies it.

## Home and detail

- Home: Agent/task selector and plus inside the lower-left editor toolbar; model/effort and send on the right; no permission or context bar.
- Detail: plus/expand on the left, model/effort, browser voice input and send/shortcut menu on the right. Below, smart/conversation on the left, existing three-level permissions and context on the right.
- Conversation mode persists per thread, is frozen on each new run, and excludes skill instructions and all tool schemas. Existing runs and retries retain original settings, including legacy empty tool snapshots. The context preview uses that same mode.
- Unimplemented attachments/search/MCP/task-board functionality is not newly introduced by this surface change.

## Expanded editing

LobeHub's src/features/ChatInput/Desktop/index.tsx uses absolute inset:0 in the conversation layout container and clears the inner border/radius. InputEditor sends only on Cmd/Ctrl+Enter while expanded.

Local implementation promotes the dock to fill its conversation column, removes the normal content width cap and inner card chrome, disables textarea autosize and flexes it to the remaining height. Toolbar and controlbar stay at the bottom. Sidebar remains usable; covered header/transcript are hidden, transcript inert. Route change resets expansion. Draft remains controlled by AgentChatPage. Expanded Enter is newline; Cmd/Ctrl+Enter sends; composition does not send.

## Verification

Isolated headless Edge profile, 1440×1000 and 390×844, fake connector catalog only:
- Home contains Agent/plus/model/send, no permission/context controls.
- At desktop, column and expanded dock both x=336, y=0, w=1104, h=1000; textarea starts at y=16 and grows to h=884; footer at y=900, controlbar at y=952.
- Expand/collapse preserves the multiline draft; Enter inserts newline.
- 120-line draft scrolls within the textarea, keeping toolbar visible.
- Context popup opens above the fullscreen editor, closes on outside click, and shows zero skill/tool tokens after switching to conversation mode.
- Conversation mode survives refresh; shortcut menu changes normal Enter to newline.
- Mobile fills the viewport without horizontal overflow; shell hamburger is hidden during expanded editing.
- No real provider credentials, model requests, or microphone recording used.
