# Implementation

1. Connector/transport owner: MiMo adapter, connector catalog/config resolution/discovery/probe and tests. Do not hand-edit model bank. Never run paid POST as connection test.
2. Runtime/data owner: shared domain, schemas/repo/retention/ZIP, generation dispatch/recovery and reference validation, regression tests. Coordinate shared adapter contract.
3. Agent owner: capabilities, strict args, review and reference fingerprint, speaker CRUD/context, regression tests.
4. Root: compact speech UI, profile save/import/reuse, responsive integration, overall specs and validation.

Workers are explicitly required by the Trellis implementation workflow. Each owns separate files and must preserve concurrent edits. Root handles final integrated checks.

Use /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm for lint/test/build/model-bank:verify; git diff --check. Review old-job compatibility and clone media retention/ZIP. Verify in browser if automation available, record limits honestly. No automatic commits.

## UX follow-up execution
1. Worker: shared MiMo defaults, Agent creation/profile resolution and tests.
2. Root: explicit toolbar voice library, create/design/clone/audition, simple contextual selection/generation, first-use connector setup.
3. Integrated review and regression gates.
