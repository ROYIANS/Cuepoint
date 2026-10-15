# E16 final review scope

Exact mirror of `review-scope.json`, which repository ignore rules exclude. Parent owns staging. No force-add used.

```json
{
  "schemaVersion": 1,
  "task": ".trellis/tasks/10-15-business-detail-link-rollout",
  "reviewer": "trellis-check /root/e03_check",
  "status": "FREEZE; ready for parent commit",
  "reviewedAt": "2026-10-15T11:57:33.622389+00:00",
  "baseCommit": "288bae60981edc07da219ec8ffe475affcc0112b",
  "excludedPrefixes": [
    ".trellis/tasks/10-15-agent-resource-capabilities/"
  ],
  "counts": {
    "product": 17,
    "tests": 12,
    "qualityConfig": 2,
    "specs": 4,
    "newRegisteredSourceModules": 7
  },
  "scopeDigest": {
    "algorithm": "SHA-256 of sorted path + NUL + file SHA-256 + newline, excluding specs/task reports",
    "sha256": "8fc1f9f46aeb0587794fc779167ec744fb64b7dadd421d34acdcbd48ac3def23",
    "fileCount": 31
  },
  "files": [
    {
      "path": "packages/studio/src/app/details/BusinessDetails.tsx",
      "category": "product",
      "sha256": "1e4baf3c8d8dc7e20b533fc97fc09b3065da3903bd0c15897bbdd2486081508c",
      "bytes": 11975
    },
    {
      "path": "packages/studio/src/app/details/ShotDetails.tsx",
      "category": "product",
      "sha256": "40aa3d7b0f76697cf74d817e14d7c2baf7ddaad9672f03ce035e3d13bd39d942",
      "bytes": 1108
    },
    {
      "path": "packages/studio/src/app/details/businessDetailTarget.ts",
      "category": "product",
      "sha256": "9245336a18c4f1689a344b36c96fc99acdc926c66624d9924c596e5a6533d5e3",
      "bytes": 2608
    },
    {
      "path": "packages/studio/src/app/layout/ContextPanelHost.tsx",
      "category": "product",
      "sha256": "e7eb233352fc8fe4cccb43fc3d810aa30f7cb8cef3c4b6d9b68ee6ed5fe15493",
      "bytes": 3503
    },
    {
      "path": "packages/studio/src/app/layout/context-panel.tsx",
      "category": "product",
      "sha256": "05751be8b2cb47f154b291f32d4f7c491ea29e29986d0764aa17bf08a07c13a1",
      "bytes": 8857
    },
    {
      "path": "packages/studio/src/app/layout/detailPanelSession.ts",
      "category": "product",
      "sha256": "554ed21da4a267791a2e11a6cc2779fb83ce95d6db7ff2bebbec0926b0b8ad0a",
      "bytes": 484
    },
    {
      "path": "packages/studio/src/features/agent/ui/AgentGenerationBatches.tsx",
      "category": "product",
      "sha256": "abba26733dba7dbf5fb5fa9ee5d768ab842bd2b8c903fd07f0aad9d1ac3a61f1",
      "bytes": 50319
    },
    {
      "path": "packages/studio/src/features/library/models/assetDetailTarget.ts",
      "category": "product",
      "sha256": "45ac8cbb211dde7fd22e48c6b240c03d0eb11e581221f826640b6c446bba4ed4",
      "bytes": 642
    },
    {
      "path": "packages/studio/src/features/library/ui/AssetDetailContent.tsx",
      "category": "product",
      "sha256": "3bfaff40d67a1bd10750af61e4a49c686f2ec476c2dc8df973f05caff363da69",
      "bytes": 8125
    },
    {
      "path": "packages/studio/src/features/library/ui/AssetDetailPanel.tsx",
      "category": "product",
      "sha256": "c6090a9aba8e4d4604cae12561c1bd961ddb55d1e6bb19db034644553f075fdb",
      "bytes": 5073
    },
    {
      "path": "packages/studio/src/features/library/ui/AssetTextField.tsx",
      "category": "product",
      "sha256": "33ccfa00376c48aa56e4de4b0200d58e657a735bb41c73af734cbbdfc3eee1e4",
      "bytes": 3415
    },
    {
      "path": "packages/studio/src/features/library/ui/CharacterDetailPage.tsx",
      "category": "product",
      "sha256": "bde7ea6550c86704ed3f0fbee4a0987b57680530518a0f482879f465302ab3da",
      "bytes": 441
    },
    {
      "path": "packages/studio/src/features/library/ui/PropDetailPage.tsx",
      "category": "product",
      "sha256": "6c7981e37afb1e1118ee78689f7a842cc064c93d3b247946980d6646d6e42fbc",
      "bytes": 436
    },
    {
      "path": "packages/studio/src/features/library/ui/SceneDetailPage.tsx",
      "category": "product",
      "sha256": "e636309290677ce81c571649570b5fc66c8ddfb1c66aa347a812660759f499a5",
      "bytes": 421
    },
    {
      "path": "packages/studio/src/features/library/ui/StyleDetailPage.tsx",
      "category": "product",
      "sha256": "285c87d3520095c63d7bce57e4f124d16f21b648bfab5e4f60dbeed832603767",
      "bytes": 441
    },
    {
      "path": "packages/studio/src/features/library/ui/assetDetailFields.tsx",
      "category": "product",
      "sha256": "8f86a5f27e35d64543155f6786e673038f31f23aad1c4c2d8f3fe19ac625104d",
      "bytes": 30786
    },
    {
      "path": "packages/studio/src/features/video/ui/ShotDetailPanel.tsx",
      "category": "product",
      "sha256": "d93814b6218c708430f38df4bd8fff6eb44dd1de79baf7da0d32d9ec444f3a6e",
      "bytes": 16822
    },
    {
      "path": "tests/b01QueryIdentity.test.ts",
      "category": "test",
      "sha256": "3bc44164bcee93ead2250bf84566541f6a97b8eb8d095753e48c8b25954adc5a",
      "bytes": 15988
    },
    {
      "path": "tests/businessDetailTarget.test.ts",
      "category": "test",
      "sha256": "2399a26b978ad7be445882db3e2281ce10b353636b1916c0b4133ab6ec73a82c",
      "bytes": 3136
    },
    {
      "path": "tests/businessDetailUnavailable.test.ts",
      "category": "test",
      "sha256": "c297498cc007263189fe84c60ed2e80f538eb7f3eadc1859ca6a96446b06ea6c",
      "bytes": 3120
    },
    {
      "path": "tests/businessDetails.test.ts",
      "category": "test",
      "sha256": "6502645d1334760a0fe9b89d3c3c07c5717ecfde9f4fe2ed1fe4c513a9219041",
      "bytes": 14218
    },
    {
      "path": "tests/contextPanelCoordinator.test.ts",
      "category": "test",
      "sha256": "6c52038f818cac753b9982e1fc2b281418d235ec82264abbd485688ece5d9898",
      "bytes": 4299
    },
    {
      "path": "tests/contextPanelDom.test.ts",
      "category": "test",
      "sha256": "836371744a06c9504db5227912184ef0376214664d3f718e43af048e072b8a6b",
      "bytes": 10691
    },
    {
      "path": "tests/e16AssetDetailPanel.test.ts",
      "category": "test",
      "sha256": "9ba333fa8849df579f5a5b322f0d5760ff651ff13cc921eadd419a4ec4fd5e34",
      "bytes": 14273
    },
    {
      "path": "tests/e16AssetDetailQueries.test.ts",
      "category": "test",
      "sha256": "450fed4ed65d71605f47dc5ac56ea737ac1e6890d623351c2d2b6208e56da903",
      "bytes": 10653
    },
    {
      "path": "tests/e16BatchDetailHandoff.test.ts",
      "category": "test",
      "sha256": "d63e6c0b094b3fbbb1e422415588af580c4e5c2eca3cdd37ee4ec4e46eac621e",
      "bytes": 24321
    },
    {
      "path": "tests/manualDraftWiring.test.ts",
      "category": "test",
      "sha256": "c0fb52226960db02846a64c9b9ca16d4c35f0f9bfa6f830a13b8dca1d9883095",
      "bytes": 32432
    },
    {
      "path": "tests/shotDetailPanel.test.ts",
      "category": "test",
      "sha256": "23ca939c5b1b3d0db8ce9f1fb17acd6524898ffc67cb55d3d0a189d7e03f307b",
      "bytes": 14398
    },
    {
      "path": "tests/shotDetailQueryLifecycle.test.ts",
      "category": "test",
      "sha256": "6280fcc3011253b7dda8479a0979959be392d708032187acfe81831d1337e061",
      "bytes": 7289
    },
    {
      "path": "quality/studio-ownership.json",
      "category": "quality-config",
      "sha256": "9b18a886475df766fcc4f0d1158a5a5c7744ad61a8613b57de8733e43c914a0b",
      "bytes": 264302
    },
    {
      "path": "tests/fixtures/shared-storage/nativeAcceptanceSuites.json",
      "category": "quality-config",
      "sha256": "532b23369044fab61079c4e65f5de53a1be161c0e097aa69a40f6ce8ffcf0f6b",
      "bytes": 6365
    },
    {
      "path": ".trellis/spec/frontend/agent-business-details.md",
      "category": "spec",
      "sha256": "799ef2c14bc379dfacb4db52b7cb85b1642d517bc18dcd7b770c83c897727792",
      "bytes": 17595
    },
    {
      "path": ".trellis/spec/frontend/component-guidelines.md",
      "category": "spec",
      "sha256": "63bea78cf18fc9409ba5164eb1df3fb4980edcda6b59eb51313556d5268f0390",
      "bytes": 46443
    },
    {
      "path": ".trellis/spec/frontend/index.md",
      "category": "spec",
      "sha256": "f3caccf1672f90eacf05c828bfe6cc771ebd3e390be50ce2a16ec15fa3c7983c",
      "bytes": 10158
    },
    {
      "path": ".trellis/spec/studio/frontend/index.md",
      "category": "spec",
      "sha256": "186d2c4f505f531594e2cae093831ddbd9f178c99f194a16790ca919234491fb",
      "bytes": 3708
    }
  ],
  "checkerChanges": [
    {
      "path": "packages/studio/src/app/details/BusinessDetails.tsx",
      "fix": "Return stale synchronously as a resolved Promise for a returnToOrigin call after real provider teardown; prevents an unresolvable return attempt."
    },
    {
      "path": "tests/businessDetails.test.ts",
      "fix": "Extend actual provider teardown case to call retained return API and assert exactly one stale settlement with no origin notification; observed failing before fix."
    },
    {
      "path": "packages/studio/src/features/library/ui/AssetTextField.tsx",
      "fix": "Alias the ordinary useLatest method to resetToLatest locally so Hooks rule does not misclassify callback invocation; shared API and behavior unchanged."
    }
  ],
  "checks": {
    "typescript": {
      "command": "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec tsc --project packages/studio/tsconfig.json --noEmit --pretty false",
      "exitCode": 0,
      "log": "/tmp/e16-review-types.log",
      "logSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "eslint": {
      "command": "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm exec eslint <all 17 product paths above>",
      "exitCode": 0,
      "errors": 0,
      "warnings": 12,
      "log": "/tmp/e16-review-eslint.log",
      "logSha256": "b0731feec09755c46d235c45c2aae94ed25788ae2fffc4be1ac56bd487ff84b1"
    },
    "focusedAfterFix": [
      {
        "suites": [
          "tests/businessDetails.test.ts",
          "tests/businessDetailUnavailable.test.ts",
          "tests/contextPanelDom.test.ts",
          "tests/contextPanelCoordinator.test.ts",
          "tests/e16BatchDetailHandoff.test.ts"
        ],
        "files": 5,
        "tests": 34,
        "exitCode": 0,
        "actWarnings": 0,
        "log": "/tmp/e16-review-facade-tests.log",
        "logSha256": "ba96094b5893b6c69aeb1d16b8532f2844e17f3757cdca6a9524dc6ec96a1c2a"
      },
      {
        "suites": [
          "tests/e16AssetDetailPanel.test.ts",
          "tests/e16AssetDetailQueries.test.ts"
        ],
        "files": 2,
        "tests": 19,
        "exitCode": 0,
        "log": "/tmp/e16-review-asset-tests.log",
        "logSha256": "841b818963a104df0ccd1f46cb19e4990d4e69a4b235a7430ca23431b293fe72"
      }
    ],
    "architecture": {
      "command": "/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node tooling/quality-check.mjs --only architecture --report /tmp/cuepoint-e16-architecture.json",
      "exitCode": 0,
      "report": "/tmp/cuepoint-e16-architecture.json",
      "reportSha256": "f292ad318e973f84b85a28d13e6d1c4955c2b5cf4892bead8da0f05bc5f2832c",
      "finishedAt": "2026-10-15T11:55:24.671Z",
      "files": 652,
      "staticValueEdges": 2556,
      "literalDynamicEdges": 12,
      "cycles": 0,
      "forbidden": 0,
      "failures": 0,
      "computed": 0,
      "all31ProductTestConfigInputHashesMatch": true,
      "runs": 2,
      "repeatReason": "Parallel first gate found ordinary-method Hook naming error after architecture completed; regenerated once after mechanical alias fix for exact final source provenance. First report retained /tmp/e16-review-architecture-pre-lint-fix.json."
    },
    "discovery": {
      "newRegisteredModules": [
        "packages/studio/src/app/details/BusinessDetails.tsx",
        "packages/studio/src/app/details/businessDetailTarget.ts",
        "packages/studio/src/app/layout/detailPanelSession.ts",
        "packages/studio/src/features/library/models/assetDetailTarget.ts",
        "packages/studio/src/features/library/ui/AssetDetailContent.tsx",
        "packages/studio/src/features/library/ui/AssetDetailPanel.tsx",
        "packages/studio/src/features/library/ui/assetDetailFields.tsx"
      ],
      "newNativeBusinessSuites": [
        "tests/businessDetails.test.ts",
        "tests/e16AssetDetailPanel.test.ts",
        "tests/e16AssetDetailQueries.test.ts",
        "tests/e16BatchDetailHandoff.test.ts"
      ],
      "nativeRun": false,
      "actualPublicEdges": [
        {
          "from": "packages/studio/src/app/details/businessDetailTarget.ts",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/video/ui/ShotDetailPanel.tsx",
          "to": "packages/studio/src/app/layout/detailPanelSession.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/library/ui/AssetDetailContent.tsx",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/library/ui/AssetDetailPanel.tsx",
          "to": "packages/studio/src/app/layout/detailPanelSession.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/library/ui/AssetDetailPanel.tsx",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/app/details/BusinessDetails.tsx",
          "to": "packages/studio/src/app/layout/detailPanelSession.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/app/details/BusinessDetails.tsx",
          "to": "packages/studio/src/features/library/ui/AssetDetailPanel.tsx",
          "kind": "dynamic-import",
          "typeOnly": false
        },
        {
          "from": "packages/studio/src/app/details/ShotDetails.tsx",
          "to": "packages/studio/src/app/details/BusinessDetails.tsx",
          "kind": "static-import",
          "typeOnly": false
        },
        {
          "from": "packages/studio/src/features/agent/ui/AgentGenerationBatches.tsx",
          "to": "packages/studio/src/app/details/BusinessDetails.tsx",
          "kind": "static-import",
          "typeOnly": false
        },
        {
          "from": "packages/studio/src/features/library/ui/CharacterDetailPage.tsx",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/library/ui/PropDetailPage.tsx",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/library/ui/SceneDetailPage.tsx",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        },
        {
          "from": "packages/studio/src/features/library/ui/StyleDetailPage.tsx",
          "to": "packages/studio/src/features/library/models/assetDetailTarget.ts",
          "kind": "static-import",
          "typeOnly": true
        }
      ]
    }
  },
  "reusedEvidence": [
    {
      "report": ".trellis/tasks/10-15-business-detail-link-rollout/research/implementation-composition.md",
      "reportedFiles": 9,
      "reportedTests": 95,
      "finalOverlappingFiles": 3,
      "finalOverlappingTests": 19,
      "recordedHashes": 14,
      "unchangedHashes": 12,
      "changedHashesRetested": [
        "packages/studio/src/app/details/BusinessDetails.tsx",
        "tests/businessDetails.test.ts"
      ],
      "doNotSumOverlappingRuns": true
    },
    {
      "report": ".trellis/tasks/10-15-business-detail-link-rollout/research/implementation-assets.md",
      "reportedNewFiles": 2,
      "reportedNewTests": 19,
      "reportedExistingFiles": 2,
      "reportedExistingTests": 23,
      "newSuitesRerunAfterAliasFix": true
    },
    {
      "report": ".trellis/tasks/10-15-business-detail-link-rollout/research/implementation-batch.md",
      "reportedFiles": 1,
      "reportedTests": 14,
      "rerunInCheckerFacadeBatch": true
    },
    {
      "report": ".trellis/tasks/10-15-business-detail-link-rollout/research/browser-asset-layout.md",
      "owner": "parent",
      "rerunByChecker": false
    }
  ],
  "remainingFindings": [
    "No known unresolved behavioral defect in the accepted E16 slice. Twelve visible lint warnings retained; no suppressions, debt or policy changes."
  ],
  "limits": [
    "No build, root quality/test/lint wrapper, broad suite, install, native, packaged, paid/live provider or Git mutation executed.",
    "Native manifest registration is discovery only.",
    "jsdom tests do not prove physical keyboard/pointer behavior, browser history, native WebView or pixel layout. Parent supplied separate real-browser asset evidence.",
    "Active Agent execution, transcript query and reading owners are unchanged; their full retained transport/scroll matrix was not rerun.",
    "Remaining entity families are explicitly outside this finite E16 scope in canonical coverage table."
  ],
  "scopeJsonIgnored": true,
  "trackedMirror": ".trellis/tasks/10-15-business-detail-link-rollout/research/review-scope.md"
}
```
