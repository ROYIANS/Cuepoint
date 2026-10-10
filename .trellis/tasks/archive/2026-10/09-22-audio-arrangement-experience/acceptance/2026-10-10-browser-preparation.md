# Native browser preparation — 2026-10-10

Browser: Codex in-app Chromium, controlled via CUA only. Development server uses 127.0.0.1:5173, separate origin from ordinary localhost, with no configured chat connector on the Agent page. Existing past acceptance projects are present in that origin; this session only created its own project and has not deleted or edited those prior projects.

Created `10-10 存量清理验收 · 音频`, project `prj_b2594f6c-5988-4acb-bdea-186e95766ab1`, through ordinary visible UI. Pasted and saved eleven non-sensitive test manuscript lines through the real import dialog. The resulting UI displayed all eleven textareas with exact saved strings. At 390×844, document clientWidth and scrollWidth both equal 390; basic manuscript and transport remain visible without page horizontal overflow. This is baseline preparation, not R3/R4 acceptance (new actions were not yet ready).

Three locally generated mono 24 kHz PCM16 WAV fixtures in this directory have exact durations 1.25, 2.5 and 3.75 seconds. They contain quiet synthetic sine tones and no user voice or external provider output. Browser decoding, placement, selection, undo and export tests will use these fixtures through the ordinary file chooser. Their existence alone does not prove decode or audition.

Real-model/vendor generation and physical microphone acceptance remain unperformed. They require an actual configured connection and a concrete user-owned capture/sample scope. Automated protocol fixtures remain separate from that evidence.
