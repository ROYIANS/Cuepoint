# B批待执行范围与验收

2026-09-30，主会话在A04实现期间核对；这里只作下一批准备，不关闭finding、不提前改产品。

| 顺序 | findings | 具体触发/必须回归 |
|---|---|---|
| B01 | SS-01, PU-05 | B01-scope-preparation研究已证project chrome混合身份与角色槽草稿错绑；先身份隔离再开放写入；query null/empty同样带身份，缺失与加载分开；保留同target草稿及跨targetdirty/pending离开保护。已有Story/Produce/Music隔离不可批量重复重挂。 |
| B02 | AU-01 | 记忆候选A/B请求乱序，编辑器已打开后其他请求不得替换；正文/ref/excerpt/baseline来自同一冻结会话。deferred双顺序验证，dirty不能静默丢弃。 |
| B03 | AU-03, PU-04 | Context只传改变字段，txn读最新合并normalize，同字段策略明确；多选按add/remove意图避免两次旧数组覆盖。两个调用不等livequery刷新仍应保留并集；取消与删除引用按owner校验。 |
| B04 | PM-02 | HTML、坏JSON、HTTP200 error envelope不能当list/probe成功；合法空目录允许。fallback POST只在原允许条件，断言每种错误请求次数，不能因protocol错误额外付费调用。 |
| B05 | PM-03, PM-04, PM-06 | 音乐taskIds集合唯一/数量/长度约束与observations/保存/schema一致；拒绝点段但保留编码task/1契约；body AbortError归取消；已提交恢复fixture唯一checkpoint/兄弟任务下载、无POST重发。 |
| B06 | SS-07, PU-07 | 连接测试/候选导入/异步文件读取携带session/epoch，旧完成不覆盖新编辑器/新本地文本/新文件；取消重开与失败出口；与A04/B01保存target协议衔接。 |
| B07 | AU-10 | 先核实thread文本draftKey与附件scope差异实际场景，浏览器/history切换验证；统一一次主题会话，失败/挂起草稿保护，不把风险直接当已复现bug。 |

证据定位仍见原模块报告；调用关系到实现时再查最新源码。A04会改变slot/session/project基线参数，B01以该最终API为准，不能照抄研究时行号。

每单元实施→回归/typecheck→独立check→spec/ledger，再推进。批末全量关口、提交确认按batch-gates执行。当前active仍A；B未start。
