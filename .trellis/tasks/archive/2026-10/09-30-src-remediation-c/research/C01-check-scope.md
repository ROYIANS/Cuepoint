# C01 independent review scope

必须覆盖实现handoff全部6source/test，以及主代理3browser文件：scripts/c01-browser-regression.mjs, tests/fixtures/c01/harness.ts,index.html。Before/after sha256包括全scope，report C01-check.md与snapshot C01-check-snapshot.json。主代理静态scan发现初版helper cognitive62+5nested；实现者正在收敛，应复核最终新增leaf和wrapup新增nested是否清零，并检查相关逻辑是否保持，不留suppression。

实际工具来源历史成功与当前合法ownedjob输出分别验证；任意含jobId read/tool被拒绝不升级；tool.result.jobId/result IDs/args/provenance必须一致。Task-generation picker保持batch限定兼容，独立wrapup gen可说明合法文件且目标删除不等于文件消失。

重点检查false source资格、当前slot非法kind/foreign episode/owner、媒体生命周期/MIME/empty，fingerprint includescurrenteligibility，call/job rows历史不改。realrw AI write rollback、publish invalidreject，非生成completed writefact兼容。

运行14项实现测试(260/含79新)及lint/静态scan、native browser green。Browser env C01_PLAYWRIGHT_PATH=/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs; C01_CHROMIUM_PATH=/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell. Installed工具不install。Browser old-source red committedB readonlytransform，bootstrapinvalidslot第一次失败不计productred。测试媒体非空假字节不宣称decode证明。

可直接修具体阻碍，仅C01，修改后复核受影响tests；no ledger/spec/commits。记录checker corrections和前后hash，primary PNPM绝对路径。原14tests green/red日志已保存任务reviews可复核。其他B记录/parent/C后续research改动主代理所有权。
