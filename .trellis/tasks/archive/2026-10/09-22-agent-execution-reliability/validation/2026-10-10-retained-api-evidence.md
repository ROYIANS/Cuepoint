# Retained API evidence refresh

The two existing reviewed export contracts remain exactly `deleteAudioTrack` and `deleteAudioSpeaker`, count 1 each. Their declaration/body bytes are identical to HEAD. The current audio module adds reviewed membership/CAS support and the spec documents v24 batches and arrangement; those whole-file edits made the original evidence hashes stale. Current callers, intentional repository API ownership, owner/CAS/atomic deletion rules, reason, counts and other five contracts are unchanged. No new Knip exemption or global rebaseline was added.

```json
[
  {
    "symbol": "deleteAudioTrack",
    "file": "src/db/audio.ts",
    "previous": "2593aa6402414d316835cc0e03a64f28a04a4dc9399e5e43d37038e20badd116",
    "current": "72808d100983aa94c74cb2916360efc74365e6b9c933748311c20cdefb4906c7"
  },
  {
    "symbol": "deleteAudioTrack",
    "file": ".trellis/spec/frontend/audio-music.md",
    "previous": "84c25cff00c0f0dd8eae4420e422ed20c2f729b6495c953801a81fdec568135f",
    "current": "ea8be073462c392309dcc290dcd09b3c245f7c5de2f1962eb8b13fdde0413f67"
  },
  {
    "symbol": "deleteAudioSpeaker",
    "file": "src/db/audio.ts",
    "previous": "2593aa6402414d316835cc0e03a64f28a04a4dc9399e5e43d37038e20badd116",
    "current": "72808d100983aa94c74cb2916360efc74365e6b9c933748311c20cdefb4906c7"
  },
  {
    "symbol": "deleteAudioSpeaker",
    "file": ".trellis/spec/frontend/audio-music.md",
    "previous": "84c25cff00c0f0dd8eae4420e422ed20c2f729b6495c953801a81fdec568135f",
    "current": "ea8be073462c392309dcc290dcd09b3c245f7c5de2f1962eb8b13fdde0413f67"
  }
]
```

Full quality gate is recorded separately after this explicit review.
