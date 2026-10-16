# Installed text skills

## 1. Scope / Trigger

Agent owns portable skill installation, device-local enablement, immutable text
versions and version retention. Pure format helpers are described in
[portable text skills](../agent-core/library/skills.md). Builtin creative skills
and their tool allowlists remain separate. Installed guidance never authorizes
filesystem, process, network, MCP, paid generation or disabled tools.

Use the existing fixed ProductStore and `deviceSettings`; no second catalogue
database, filesystem installation owner, new table or schema migration is needed.
Feature sources live under `features/agent/skills/`. Their UI integration belongs
to Agent UI and the retained ContextPanel, not a new route or drawer.

## 2. Signatures / Owners

Host parser: `skills/runtime/package.ts`:

```ts
prepareSkillImport(directoryName: string, files: readonly SkillImportFile[],
  priorExclusions?: SkillImportExclusions): SkillImportCandidate;
verifySkillCandidate(candidate: SkillImportCandidate): SkillImportCandidate;
decodeSkillFrontmatter(frontmatter: string): unknown;
```

Queries: `skills/queries/installedSkills.ts`, all with optional explicit
`ProductStore` as the final argument:

```ts
getInstalledSkillCatalogue(store?): Promise<SkillCatalogue>;
getInstalledSkillManifest(descriptor, store?): Promise<SkillManifest>;
loadInstalledSkill(descriptor, store?): Promise<{manifest; document; body}>;
readInstalledSkillResource(descriptor, path, offset?, limit?, store?): Promise<SkillTextRange>;
```

Mutations: `skills/commands/installations.ts`:

```ts
installSkill({operationId, catalogueRevision, candidate, enabled}, store?);
updateInstalledSkill({operationId, catalogueRevision, skillId, expectedRevision, candidate}, store?);
setInstalledSkillEnabled({operationId, catalogueRevision, skillId, expectedRevision, enabled}, store?);
uninstallSkill({operationId, catalogueRevision, skillId, expectedRevision}, store?);
reconcileSkillMutation({operationId, catalogueRevision}, store?);
```

Publication returns `SkillMutationReceipt` with operation identity/fingerprint,
kind, installation identity, content revision and new catalogue revision.
Reconciliation returns `committed` plus receipt, `unresolved`, or `conflict`.
It performs readback, never another mutation.

Retention: `skills/commands/retention.ts`:

```ts
retainInstalledSkills(tx: StoreTx, previous?: InstalledSkillsSnapshot): Promise<InstalledSkillsSnapshot>;
releaseInstalledSkills(tx: StoreTx, snapshots: readonly InstalledSkillsSnapshot[]): Promise<void>;
```

The owning caller must supply a read-write transaction scoped to
`deviceSettings`. These helpers do not independently admit/delete a run.

## 3. Contracts

The supported package is one exact root `SKILL.md` plus bounded UTF-8 text
resources. Strict decoding rejects malformed UTF-8 and NUL; BOM and CRLF remain
part of the hashed original document. Studio declares its direct maintained YAML
dependency. YAML aliases, explicit tags, duplicate keys, multiple documents and
excessive nesting reject before conversion to JavaScript. Unknown decoded values
pass through neutral metadata validation, never type assertions into policy.

Installation review uses an owned snapshot, never a path that will be reopened
at publication. The command rebuilds/revalidates that candidate before opening
the storage transaction. Identity hashes sorted logical paths, exact UTF-8 byte
lengths and component digests with explicit framing. Scripts, binaries, hidden
content, nested skill packages and unsupported text locations are excluded;
bounded exclusion details remain visible in the candidate. Native source
containment is a separate host obligation; logical names alone do not prove it.

| Existing device-setting key | Value |
| --- | --- |
| `agentSkills.catalog.v1` | Versioned metadata entries, catalogue CAS revision, retained digest index/serialized accounting and last mutation receipt |
| `agentSkills.content.<digest>` | Immutable manifest: metadata, root document component, resource path/digest/byte length/ordinal |
| `agentSkills.body.<digest>` | Exact root document text and its revision/path |
| `agentSkills.resource.<digest>.<ordinal>` | One immutable resource's text and revision/path |
| `agentSkills.retention.<digest>` | Current installation references, recorded-run references and complete content-group serialized size |

Catalogue discovery reads only the catalogue row. Loading reads only the selected
manifest and root document. A resource read uses only the selected manifest and
that resource row; its byte length and digest must match. Missing/corrupt content
never falls back to a current source or same-name installation.

Commands strictly read catalogue/retention through their actual transaction.
`getDeviceSetting`'s forgiving read is inappropriate for authoritative mutation.
Validate/copy/hash before the transaction; publish content, pointer, counts and
receipt inside one transaction. Nested helpers receive the same explicit store.
Catalogue CAS and expected current revision reject concurrent stale operations.
The same recorded operation/fingerprint can return its prior receipt; unknown
commit outcomes require readback and block automatic replay. A missing receipt
while the catalogue revision is unchanged remains unresolved: it does not prove
that an earlier native commit can no longer finish. If a later writer
has replaced the bounded receipt, report conflict rather than infer success.

An installation gets a fresh `skillId`; update preserves it and changes the
revision. Same name requires explicit update and builtin IDs are reserved.
Disable retains current content. Uninstall removes future discovery and releases
only its current reference. Collect the complete immutable group only when both
current and recorded-run references are zero. Never evict pinned content to make
room. Retention release does not change the catalogue mutation revision/receipt.

Shared bounds are `SKILL_LIMITS`: 32 installed/16 enabled, 24 KiB serialized
model catalogue, 2 MiB per value and whole content revision group, 128 retained
revisions and 64 MiB serialized retained content. Check actual UTF-8 JSON size,
including escaping. New content cannot overwrite an orphan/corrupt group.

## 4. Validation & Error Matrix

| Condition | Required outcome |
| --- | --- |
| Invalid YAML/UTF-8/root/name/path/collision/section/file/count/byte limit | Fail before publication |
| Candidate changed after review | Reject; require reselect/review |
| Builtin or installed duplicate name | Reject install; explicit same-name update only |
| Stale catalogue/current revision or reused operation identity with another fingerprint | Conflict with no partial writes |
| Native commit response unknown | Retain uncertainty; explicit receipt readback, no duplicate install |
| Readback unavailable/newer unrelated writer | Keep blocked or report conflict; never claim rollback/success |
| Quota exhausted or malformed/missing counter/content | Fail closed; preserve existing version and pinned history |
| Late table failure during publication or release | Same outer transaction rolls back all earlier changes |
| Unlisted/unsafe resource path or hash mismatch | Explicit read failure without opening source files |

## 5. Good / Base / Bad Cases

- Good: manually update a skill while a recorded run retains the old revision;
  new sends use the new pointer, old reads resolve old immutable bytes.
- Base: import a text-only skill disabled, inspect its document, and explicitly
  enable it for future eligible runs. No model request starts during management.
- Bad: use one huge content row for all texts, which hydrates every reference on
  body load; or release recorded-run pins on disable/uninstall/project deletion.
  Actual run owners decide admission/deletion, independently of current settings.

## 6. Tests Required

`tests/installableSkills.test.ts` uses the real ProductStore, explicit transaction
handles and reached late table faults. Cover malformed parser inputs, exact byte
identity, quotas, stale CAS, same-name manual update, enablement, fresh reinstall
identity, uncertain commit/readback and corruption. Spy on transaction-bound
reads to assert metadata discovery does not hydrate content, body reads do not
hydrate resources and a selected reference never reads siblings. Retention tests
must verify all referenced old bytes survive and only zero-count groups collect.
The finite E09 source Vitest/noEmit profiles are necessary affected evidence;
full regression, emitted/packed consumers and native installed acceptance remain
at the user-approved epic-end boundary.

## 7. Wrong vs Correct

Wrong:

```ts
const catalogue = await getDeviceSetting('agentSkills.catalog.v1');
await store.transaction('rw', ['deviceSettings'], async () => {
  await installSkill(input); // Escapes the explicitly supplied owner.
});
```

Correct:

```ts
const candidate = prepareSkillImport(directoryName, capturedFiles);
const receipt = await installSkill({operationId, catalogueRevision, candidate,
  enabled: explicitlySelected}, suppliedStore);
// An uncertain response is reconciled by operation identity; never replay blindly.
```
