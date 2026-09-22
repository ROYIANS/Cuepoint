# Remaining release acceptance — 2026-09-22

Implementation checkpoints are delivered and archived separately; this parent and audio-music-agent-integration own final release acceptance. Prior passing tests/browser flows remain evidence, but do not prove newer surfaces or live providers.

- Recheck latest music creator, MiMo voice library/setup and timeline context/keyboard controls on desktop and narrow layouts. Baseline audio/manual import/edit/render browser acceptance already passed.
- Exercise physical microphone permission/capture/stop/save and a complete recorded take flow when the device environment is available; mocked failure/cleanup regressions already pass.
- Run controlled real-model project create/read/edit and reviewed generation/status recovery in isolated test projects. Record actual calls and stop causes; paid requests need a concrete test scope. Previous tests use deterministic provider fixtures.
- Live MiMo/APIMart CORS, account-specific behavior and sound quality remain unverified; no successful live generation or audition is claimed.

Agent semantic execution/fact-checking, batch voice production and reviewed arrangement are tracked in the Agent experience initiative, not duplicated here. Music composition/stems/MIDI remain deferred. Umami deployment is separate operator work, not an audio release blocker.
