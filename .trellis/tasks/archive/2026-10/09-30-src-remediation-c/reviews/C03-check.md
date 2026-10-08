# C03 independent check — PASS

四文件完整 before/after 审阅、入口源码备份哈希验证、前序 C01/C02 21 文件哈希核对完成。最终哈希见 `C03-check-snapshot.json`。

- 四资产 create 的最小 projects+对应资产 rw 事务依次读父、写入、touch；putMedia 在原两表事务中读父。Studio 无需真实项目行。删除父后延迟创建拒绝、真实 updating hook touch 失败回滚、宽 Agent 嵌套提交/回滚全部通过；无 detached promise/吞错。
- 现代 raw episode/beat FK 在 parseShot repair 与 ID remap 前验证；episode/shot 和单集 beat 重复、primitive `7`/`"7"` 碰撞拒绝。跨集同 beat ID 分别 remap；现代无首集 fallback。缺失/空 episodes 保留 legacy，unknown extra 往返保留，audio/music 视频记录拒绝路径保留。
- 真 ZIP 拒绝及中途存储失败比较全部 DB 表快照，既有数据不变；邻接 CAS、撤销、media 历史、studio copy 回归通过。

Checker 发现并修正：现代单集 `[{title:"missing"},{id:"beat_0"}]` 经规范化产生重复 beat ID，原实现导入成功。`C03-check-identity-red.log` 保存 18 项中该 1 项失败证据。parseEpisode 现复用唯一性校验，在 remap 前拒绝合成 ID 冲突。仅调整 projectPackage 及其关系测试，新增 3 项：该冲突、episode primitive 碰撞、shot primitive 碰撞；并确认合法未引用缺 ID beat 仍可导入。C03 新回归由 38 项增至 41 项。

| 独立最终门禁 | 结果 | 日志 |
| --- | --- | --- |
| 聚焦测试 | 13 文件 / 185 项通过 | C03-check-tests.log |
| TypeScript lint | exit 0 | C03-check-lint.log |
| 静态差量 | repo 11→11，package 60→60；新增 0，无 suppression | C03-check-static-summary.json及原始 before/current |
| Native C01 | Chromium IndexedDB 6 checks，外部请求 0 | C03-check-native-browser.log |
| 空白检查 | 通过；新文件 no-index 差异 exit 1 无诊断 | C03-check-whitespace.log |

真实测试调用：`/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm test <13 files>`；wrapper 展开为 `vitest run <同一13 files>`，没有调用 pnpm exec 或完整 suite。commands JSON 区分实际调用与展开命令。Native C01 因 addCharacter/putMedia 创建路径变更重跑；仅证明 fixture 的原生 IndexedDB 场景，不声称完整产品或付费 provider E2E。

C03 无剩余阻碍，可进入主代理规范/台账流程。Checker 未改 spec/ledger、未提交/归档，未进入 C04/D；AR-04、D01 等非本单元发现仍保持待处理。
