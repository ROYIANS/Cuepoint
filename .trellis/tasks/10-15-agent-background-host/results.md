# E11 implementation evidence

Implementation is in progress on `codex/agent-background-host`. The owner approved the four source stages on 2026-10-16. This record distinguishes stage checks from the parent epic's deferred full/build/installed acceptance.

## Stage 1 — application execution foundation

Changes: React-free draft/submission/action models; headless existing Studio send/retry/approval/recovery flows; one bootstrap-composed execution service with synchronous per-thread claims, exact Stop and original completion; explicit ProductStore propagation through thread-lock recovery. Existing foreground UI ownership remains until Stage 2 connects the service and removes departure cancellation coherently.

The implementation agent exercised actual ProductStore, Studio runtime and core binding with controlled transports, held tools and held terminal writes. Its finite source lane passed 8 files / 96 tests; finite TypeScript (including changed bootstrap/tests/profile) passed; changed production TypeScript ESLint passed with 30 existing UI warnings; actual architecture reporter scanned 731 sources with zero failures. Independent Stage 1 review completed on the final product bytes. It added E11-only Knip/Node-TypeScript/quality-input discovery, fully initialized the invocation before notification, projected only keyless connector identity, froze retained nested thread data, froze the supplied binding, and verified reentrant shutdown retains one original promise. No Stage 1 issue remains.

Final reviewer checks: 8 files / 96 tests passed; finite TypeScript and `tsconfig.node` no-emit passed; all 24 changed/new TS/TSX/config inputs are in the finite TypeScript program; changed production ESLint had zero errors and the same 30 existing UI warnings (new service zero warnings); architecture scanned 731 sources with zero failures and zero cycles; tracked/new typed input whitespace checks passed. Root additionally validates task manifests and the staged full-scope diff before committing. The quality inventory already recursively hashes `tests/typecheck`; its root config list now includes the E11 Vitest profile.

The finite type profile excludes three unchanged test files with existing typing defects: `agentRuntimeOwnership.test.ts` (missing connector protocol and generic mock return), `agentRuntimeCredentials.test.ts` (missing connector protocol), and `e03ExecutionPresentation.test.ts` (`createElement` omits required children in props). All three remain in the passed runtime test lane. All changed test files are typechecked. B07 lost-ack recovery keeps real ownership assertions through a partial mock and waits the UI-started original recovery promise; its timeout and assertions remain intact.

No full regression, whole-app build, emitted/packed-consumer acceptance, native lifecycle check, packaging or installed-OS acceptance is established by this stage. Those gates remain scheduled as specified in `implement.md` and the parent roadmap.
