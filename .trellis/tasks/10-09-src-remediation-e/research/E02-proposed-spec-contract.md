# Proposed E02 spec synchronization — awaiting independent PASS

Append native row action contract to frontend/component-guidelines.md and winning responsive cascade contract to frontend/chat-performance.md. No public component signature changes.

## Component addition

### 1. Scope / Trigger
Read before changing TopicSidebar row selection, rename/delete actions, focus visibility or menu targeting.

### 2. Signatures / Owners
`TopicRow` owns a noninteractive `.agent-topic-row` container and sibling native `button type="button"` controls: `.agent-topic-row-title` selects, `.agent-topic-row-action` renames/deletes. Existing TopicSidebar/AgentChatPage callbacks retain mutation/navigation/departure ownership.

### 3. Contracts
Row actions must be in the Tab order even when the row is inactive and unhovered. CSS reveals them on hover, active or `:focus-within`; every keyboard-focused control has a visible ring. Child Enter/Space activates only that native button and intended thread; it must not invoke row selection. The selection button retains native Enter/Space and pointer behavior. Actions are siblings, never interactive descendants of a row button. Preserve accessible names and pointer/context-menu target semantics. Explicit role attributes may support existing DOM-based test targeting; they do not replace native semantics.

### 4. Validation / Error Matrix
Inactive + unhovered + Tab → title focus reveals actions; next Tab reaches rename/delete. Child Enter/Space → correct target dialog, current selected thread and route unchanged. Title Enter/Space/pointer → intended selected thread without action dialog. Hover/active/context menu → existing visibility and intended owner. Failed/pending mutation → existing E01 owner guards remain responsible.

### 5. Good / Base / Bad Cases
Good: native sibling selection and action buttons, focus-within visibility. Base: inactive row initially hides action paint while retaining keyboard reachability. Bad: parent role-button handles bubbled keydown, child only stops click, or action DOM exists only on hover/active.

### 6. Tests Required
Real browser Tab from an external anchor into an unhovered inactive row, both activation keys for title/rename/delete, actual controlled dialogs/native persistence and selected-route assertions, hover/pointer/context menu, focus ring and E01 draft guard integration. Update old test targets to actual interactive buttons when semantics change, preserving assertions and timeouts. A programmatic callback behind an inert modal is limited callback integration evidence, not a physical pointer claim.

### 7. Wrong vs Correct
Wrong: put onSelect on a parent button-like row containing ActionIcon descendants and handle every bubbling key. Correct: make selection/actions independent native buttons and reveal actions from CSS focus ownership.

## Chat layout addition

### 1. Scope / Trigger
Read before changing agentChat.css message/composer gutters, 767/768 breakpoint, safe area, expanded composer or turn rail.

### 2. Signatures / Owners
ChatWorkspace retains desktop inline variables `--agent-chat-safe-x`/`--agent-content-max` and measured `--agent-chat-composer-safe`. agentChat.css owns winning narrow overrides; MessageList scroll and TurnNavigation retain existing specialized rules.

### 3. Contracts
At width ≤767px, final computed message/dock horizontal padding is8px, `.agent-content` max-width none and horizontal margins0, dock bottom padding `max(12px, env(safe-area-inset-bottom, 0px))`. At768px and desktop preserve16px gutters/800px content maximum and16px dock bottom padding. Narrow rules must win against later same-specificity shorthand/base rules. Preserve header hamburger clearance44px, last-line composer/scroll clearance, the more-specific turn rail24px gutter, and expanded composer full-column padding0/max-width none.

### 4. Validation / Error Matrix
390/767 native zero-inset →8px/12px/no800px cap.768/desktop →16px/16px/800px cap. Narrow nonzero-inset surrogate32 →32px with actual max/cascade evaluated. Expanded mode → full column, underlying message surface inert. Long history → last paragraph above dock and no document horizontal overflow. Turn rail → dedicated24px gutter preserved.

### 5. Good / Base / Bad Cases
Good: winning responsive rules after the relevant base declarations, with specialized expanded/rail selectors preserved. Base: desktop variables remain unchanged. Bad: inspect an early media block without checking later shorthand/max-width declarations, or strengthen specificity globally and break expanded mode.

### 6. Tests Required
Actual ChatWorkspace computed styles/geometry at390/767/768/1440, final message scrolling, expanded composer, turn rail and screenshots. Baseline source counterfactual reproduces overwritten narrow styles. This installed Chromium exposes native safe-area bottom0 and does not support CDP setSafeAreaInsets; label32px env-to-custom-property testing as a CSS surrogate, never real iOS/device evidence.

### 7. Wrong vs Correct
Wrong: assume an early media query wins because viewport matches. Correct: assert final computed properties after the whole cascade, including shorthand, inline variables and specialized selectors.
