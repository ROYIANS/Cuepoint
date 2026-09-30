# C03 refreshed boundaries

准备；等C02已独立通过才实现。

repo putMedia原db.media/db.projects txn和addCharacter/Scene/Prop/Style两表txn，先在同写事务读取非STUDIO_LIBRARY_ID父项目存在，再add/touch。不存在父实体抛错而非touch silently0；studio系统空间无需真实projects行。现有copy/slot路径不能被放宽。

projectPackage imported parsedEpisodes当前remap在原对象上mutate，现代shots原episode不存在fallback第一集，beatMap不存在fallback第一集。先在ID remap前按原episodes/beat IDs建立并验证索引；现代每shot episodeId有效且beatId属于自己的episode；duplicate IDs(episode/shot/beat等关键对应)不能被map吞掉。任何错引用应导入失败且DB零新增。没有episodes的旧包只走显式兼容分支补第一集并保留旧beat重映射。注意空episodes与缺失episodes合同，以实际hasEpisodes定义区分；不要发明现代包修复fallback。保留其他可选unknownextra及旧合法包行为。

回归包括延迟putMedia/asset创建在父删除后拒绝无孤儿，touch故障回滚；studio四资产/媒体兼容；实际ZIP现代missing/foreign episode/crossbeat/duplicate IDs拒绝，DB不变；合法现代和legacy导入往返。

刷新：当前hasEpisodes=episodesRaw.length>0，文件缺失和显式空数组均走原legacy逻辑。C03保持此现有兼容；现代非空episodes的FK必须严格，不自行按文件存在改变空数组兼容。

现代raw判定提醒：parseShot当前把缺失episodeId补传入fallback；严格现代验证必须在这一repair发生前检查原raw的episodeId，并在解析episodes ID mutation前建立原始索引。normalizeEpisodeStory对无效/缺失beat id可能补值，现代引用检查应以实际原ID定义对照，避免先规范化后把重复/缺失身份吞掉。legacy映射保持其旧规范化能力，不对整个旧schema新增全面strict约束。

Identity scope: duplicate episode IDs or shot IDs ambiguous within their own imported table; duplicate beat IDs ambiguous within one original episode. Existing beat remap maps are scoped per episode, so the same beat ID in two distinct episodes is not intrinsically ambiguous and should not be blanket forbidden. Validate exactly the scopes used by actual relationships; do not reject unrelated cross-domain equal IDs or add whole-schema strictness. Modern absent episodeId must reject before parseShot suppliesfallback.

纠正前述txn描述：实际当前addCharacter/Scene/Prop/Style根本没有外层transaction，分别await.add→touchProject，项目touch异常已经提交孤儿资产。C03须为各create建立最小两表rw transaction(项目+具体资产)并在其中验父/写/touch，nested Agent widertransaction仍兼容；putMedia已经media/projects txn需补父检查。不要假定四create已有txn而只加read。原PD01诊断覆盖此断裂，meaningfultouchfail回滚必须运行。
