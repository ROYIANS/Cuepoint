# C05 boundary and consumers

准备；等C04独立通过才实现。

43条direct imported+namespace patch calls以及4个namespace函数引用已由TypeScript AST记录C05-static-call-sites.json；namespace调用/asset dispatch引用已纳入；限制是未解析computed references/dynamic payload数据流。人工跟读额外businessTools namespace repo.patchShot/patchProjectOutput及asset dispatch table函数引用：真实business schemas/shotPatch只允许业务文本关系；productionProposals shot-text去除result后patch；ShotEditor关系save变量只修改propIds/styleId；column.id动态字段须白名单核对。不要用grep次数当全caller证明。

优先收窄资产patch的slots和shot patch firstFrame/lastFrame/clip到专用槽位API；如果现有测试/兼容实际依赖宽patch，先建立兼容策略，可选择在同PRODUCTION_TABLES txn通过同严格assertSlotMedia+diff回收。两种方案都要运行时拒绝或校验媒体字段，不能仅TS Omit。不需保持非法fixture行为，测试建立合法媒体/专用槽位。封面patchProjectOutput current直接接任意mediaId；必须owner/nonempty/image MIME严格检查且替换回收与原history/shared引用保留一致。

当前assertSlotMedia检查result/reference（注意kind不止MIME前缀，slot目标图/视频适配），set*Slot在统一PRODUCTION_TABLES锁里校验、put、touch、recycleSlotMedia。历史job/proposal/batch保留媒体不应被回收掉；基线CAS和bulkundo原子契约保持。

测试API合法同owner及foreign/missing/empty/wrongMIME拒绝零变更；宽patch与专用set一致或宽入口明确拒绝；共享/历史引用媒体保留，真正orphan回收；封面valid/clear/foreign及写failrollback。刷新所有消费者含dynamic调用后记录表。

完整当前调用观察：businessSchemas.assetFields只有文本，shotFields只有文本/关系且不带槽位；businessTools assetApi四种patch引用最终走api.patch(args.id,args.patch/fields)。shotPatch输入来自strict schema，输出rest及nullable关系规范化。productionProposals text change只允许已归一字段并去除历史result。产品入口无需继续资产slots/shot媒体宽patch；现有测试所用宽入口须核实是否仅fixture。选择收窄时仍保留UI ShotEditor变量Partial<Shot>类型可赋给更窄optional结构，运行时unsupported拒绝应无silentstrip防误导。

现有slotkind兼容细节：asset-output-foundation spec允许shot.clip是image规划占位或video；不要C05顺便将clip强制video。setShotSlot现只assertSlotMedia根据result.kind验证媒体；C05覆盖宽patch绕过与封面不改这个已记录规划占位合同。C01判断video job是否applied要求结果jobkind一致，和C05 clip可接受image占位不是冲突。现productionContext/projectPackage等tests确有wide patch建立slot fixture，应改合法媒体/专用set或选保留strictvalidatedpatch；不要仅textOmit后测试silentfilter通过。

Actual dedicated kind caveat from read-only refresh: assertSlotMedia currently verifies media MIME against result.kind but does not receive target-kind policy. asset-output-foundation.md line36 states asset/still result slots accept images, clip image-placeholder orvideo. C05 test same-owner wrong declared-kind and wrong target-kind separately; if helper currentlyacceptsassetvideo/stillvideo, make the minimal target-aware enforcement consistent with this existing spec, while preserving clip both kinds. Avoid claiming only MIME consistency proves target compatibility. CopyStudioAsset uses this helper as well; preserve owned valid copies.
