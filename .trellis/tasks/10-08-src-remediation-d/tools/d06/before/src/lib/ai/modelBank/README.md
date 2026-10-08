# Complete Model Bank adapter

The source of truth is the unchanged `vendor/lobehub/model-bank` snapshot, not a
handwritten selected-model table. See `vendor/lobehub/README.md` for provenance,
counts and manual synchronization. The upstream license is preserved there.

- `models.generated.json`: complete default model arrays from all 85 upstream
  static provider catalogs, retaining every field, order and provider variant.
- `lookup.generated.json`: derived token limits with upstream source paths for
  synchronous context UI; it never invents aliases or missing values.
- `loadModelBank()`: lazy access to all raw model records, including pricing,
  capabilities and generation schemas. Importing the context UI does not eagerly
  bundle the full descriptions and parameters.
- `getModelBankEntry(model, providerId)`: exact provider+ID first, then exact IDs
  in original vendor catalogs. Conflicting fallback limits remain unknown. Multiple
  gateway entries are never collapsed in the full dataset.
- `resolveModelMetadata`: valid live provider fields override bank references per
  field. Source URLs pin the copied upstream revision; copiedAt is provenance,
  not a claim that model facts were independently verified today.
- `reasoningPolicy.ts`: application wire compatibility remains separate. The
  upstream dataset is complete even when our client does not implement a parameter.

Unknown IDs stay unknown; no values are extrapolated from similar names. A bank
entry is metadata, not proof that the configured connector offers that model.
Original pricing is preserved, but never represented as another gateway's price.

Manual sync regenerates from copied source with TypeScript transpilation in a VM;
only snapshot-local modules and the already installed zod are available. It is for
trusted local source, not arbitrary downloaded scripts. All source files remain
unchanged. The generator refuses non-JSON model values instead of silently dropping
fields. `model-bank:verify` checks every source hash and exact generated output.
The upstream tests are retained as source; our test suite runs only `tests/` and
verifies snapshot integrity plus application adapter semantics.
