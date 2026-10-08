# C02 refreshed actual consumers

C01还在实现；本文件只是下一项准备。

src/db/music.ts validateMusicSettings uses finiteAudioNumber allowing fractional seconds (FlowMusic1..240, Suno10..360); musicTools uses s.number(range), generation/input and apimartAudio use integer zod. 统一可选时长整数+边界，允许未填写时长及未完成的文本草稿，不把生成前完整性全部强加保存。

优先domain/music.ts导出简单数值规则/常量供工具广告schema、仓库、生成/适配器使用，实际决定避免重复。保持wire合同。所有新增/编辑settings拒绝NaN/fraction/out-of-range且事务不写账本。

旧数据：既有fractional草稿仍可music_read/UI读取并明确生成前校验错误，可修改settings修复，不静默四舍五入。patchMusicWork只允许title/notes/favorite，但validateMusicWork会连历史不可编辑settings重新验证；不得因此让旧作品元数据无法编辑。audioProjectPackage settings解析当前number允许fraction，validateImportedAudioSnapshot调用validateMusicDraft/Work；可保留历史包的fractional settings以便读取修复。显式legacy验证路径只用于已存在不可变settings/导入，不让新增仓库或工具保存也豁免，保持旧range及非时长校验。

预期文件domain/music.ts、db/music.ts、agent/musicTools.ts、audioGeneration/input.ts、ai/apimartAudio.ts以及audioProjectPackage.ts如必要；检索MusicSettings所有写入/导入/生成调用。测试FlowMusic/Suno合法两端、30.5/NaN/Infinity/越界、可空草稿、工具广告integer及实际prepare/execute拒绝、旧草稿读取诊断修复、旧作品元数据更新、旧ZIP roundtrip、合法wire。不改C04fingerprint路径。

真实UI补充：MusicCreation只有Suno Custom显示期望时长，Simple/Custom切换切另一持久化draft，不是在当前行切custom。旧工具能写Simple durationSec=30.5；严格保存后Simple用户改prompt/save/gen都被这隐蔽字段阻断。C02授权增加MusicCreation最小显式历史清除入口（仅有需要修复的历史Simple duration时），保留原值到用户动作，不自动舍入/丢字段。清除走已有useDebouncedDraft/CAS，当前dirtytext也保留；callback保存失败/并发冲突留draft。新增UIconsumer与意义callback回归必须列handoff/check/hash；不重排正常Simple UI或D03范围。
