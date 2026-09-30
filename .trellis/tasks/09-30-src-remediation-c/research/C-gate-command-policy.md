# C gate command policy

Use explicit local pnpm `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`, actual10.15.0 matchespackageManager. User9.12historicalnote isnotruntime used. No dependencyinstallation. Node24.11.0local.

Focused runs: prefer `pnpm exec vitest run <files>` with actualabsoluteinvocation. `pnpm test <files>` has been observed to expand scoped vitest run correctly; earlier confusion involved `pnpm test -- <files>` where separator led to entire suite in priorClogs. Preserve actualcommands/log counts; do not falsely claim all baretest filters expand incorrectly. Finalgate intentional `pnpm test --reporter=dot` coverssuite. package lint=TypeScript tsc, so isolatedESLint/SonarJS is an additional read-only check, not package lintbehavior.

All four browser runners use installedPlaywright/Chromium paths fromC01/C02scopes; they are finite localfixture proofs, notwholeUI orliveprovider. Build routeformat change canbe restoredonlyequalTSscanner tokens. Fullgate hashes source/tests ANDfourbrowserrunners before/after. Independentreviewer may inspect completed finalimmutablegate evidence, only repeat checks whennewfailure/changejustifies. Any sourcechange refreshes matchingindependenthashcoverage.
