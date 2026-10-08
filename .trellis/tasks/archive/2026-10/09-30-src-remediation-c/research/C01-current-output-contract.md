# C01实际边界

读取AR-01/02原报告与B提交后源码：wrapupEvidence jobs遍历目前只检查media记录存在，并给job.callId或参数jobId相同的所有工具覆写outcome/supportsResult。工作记录已有completed资格检查，但图片视频当前媒体检查也需复核统一。

修改范围：src/db/agentTaskRecords.ts、src/lib/agent/wrapupEvidence.ts，以及必要的图片/视频当前证据共享leaf（参考taskAudioGenerationEvidence，不从新leaf导入generationRuntime以免扩大D01循环）；必要domain类型尽量不改变持久化shape。实际record/wrapup调用的聚焦测试与实现handoff。

结果有效性要求：合法job生命周期和result.kind与job.kind吻合；media.projectId归属、非空Blob与正确图片/视频MIME；当前合法target/slot才能标为applied，删除/外来/替换target不假造当前应用。下载文件本身与当前应用分开，deleted-target已有合法下载可保留独立文件事实，按既有契约核实。

工具证据资格独立：rejected/failed/unknown/pending不被旧job升级；任意非生成工具含jobId不获成果资格。completed生成工具仅在对应真实成功结果且关联job合法时可补当前成果；历史body/账本不改写。独立generation证据可继续描述合法旧文件。AI results不接受无效或被拒绝来源；用户流程原有能力兼容。

回归：空/外来/错误MIME/错result.kind/非法生命周期、删除/换slot、各调用状态及任意jobId工具、publish/schema拒绝；assert账本未修改。无网络/解码在写事务；维持Dexie原Promise zone采用。记录实证red→green，lint和相关测试通过，再交独立check。

主代理补充实际native browser验证：scripts/c01-browser-regression.mjs + tests/fixtures/c01/*，读取160生成/161call并实际start/publish拒绝及media删除后的来源资格；red用B提交源的Vite只读替换证明，green已过6checks/0externalrequests。必须纳入独立C01全scope复核/sha256；fixture非空字节不是图片解码证明。
