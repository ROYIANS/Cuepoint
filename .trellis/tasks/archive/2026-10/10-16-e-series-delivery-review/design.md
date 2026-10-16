# Review design

- Read-only. Per delivery: archived PRD -> task.json claims -> `git show --stat <commit>` -> code -> tests -> dsh counterpart.
- Severity: P0 data loss/security, P1 functional gap against PRD, P2 robustness/maintainability, P3 nit.
- Evidence label: [code], [test], [claim-only]. Claim-only means no executable evidence was found.
- Reference: /Users/xiaomengdao/WebstormProjects/deepseek-harness (read-only).
