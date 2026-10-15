# Retained Electron storage reference

This pre-Tauri prototype is retained as source/reference evidence. Normal product builds use `apps/desktop` and do not execute Electron. Its existing independent dependency lock is preserved; the incomplete historical launcher references absent renderer/test/main inputs and is not a supported normal-product command. Shared helper imports use the parent desktop package's explicit Studio reference exports. No storage migration, second product owner or automatic fallback is introduced.
