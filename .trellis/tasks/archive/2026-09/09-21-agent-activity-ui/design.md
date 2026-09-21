# 设计与边界

## 最小差距及根因
AgentRunDetails 强制 needsAttention 展开并禁用折叠；所有调用集中在开头。runChat 每模型轮重置 message，过程文本虽保存在 continuationMessages，但没有面向展示的公开思考快照。composer 只显示 run/task，遗漏 run 完成后的批次待办。

## 数据契约
AgentRun 可选 activitySteps: Array<{step:number;content:string;reasoning?:string;reasoningDurationMs?:number}>。saveToolRound 在原事务中保存本轮公开输出；不得展示 Responses 加密 reasoning 或更改请求信封。旧记录只从 continuationMessages 中匹配当前 run 工具 providerCallId 的 assistant round 恢复文本。buildRunActivity(run,calls) 返回顺序项：{kind:'text',id,content} | {kind:'reasoning',id,content,durationMs?} | {kind:'tools',id,calls:AgentToolCall[]}，合并无文字/思考隔断的连续工具。

## 展示契约
AgentRunDetails 接收当前 ChatMessage，负责统一 process header/timeline。执行中展开，完成/停止后仅在状态转换时收起，手动展开不受每次数据库刷新覆盖。最终模型答复始终在 ChatItem 正文；旧工具轮留在 message 的文本不得误当最终答复重复显示。用时为本轮自然经过时间，运行时实时，非运行时固定在 endedAt 或 updatedAt；提示语说明包含等待时间。状态为暂停/待确认时不宣称完成。公开思考与工具都属于过程。

## 交互导航
新增 AgentActivityNavigation.tsx Context，provider 包裹 AgentChatInner；useAgentActivityNavigation() => {request: {runId:string,callId?:string,batchId?:string,key:number}|null,reveal(target)}，target 不带 key。底部提示 reveal，过程组件收到对应 run 请求展开并定位，批次组件收到对应 batch 请求打开已有弹窗。作用域随 threadId 重置。不会执行审批/付费等动作。批次组件在过程折叠时保持挂载，保留草稿和导航保护。

## 代码责任
数据：domain/agent.ts、db/agentTools.ts、lib/agent/runChat.ts、新 runPresentation.ts 与单测。
过程：MessageList.tsx、AgentRunDetails.tsx、ThinkingPanel.tsx、新过程 CSS/子组件。
提醒：AgentChatPage.tsx、AgentGenerationBatches.tsx、新 Context、提醒组件/CSS、纯选择器/测试。
不改 provider/支付执行/权限协议，不引入UI库、不更换整体品牌。工作区原有审查日志不纳入本次变更。

## 追加设计：对话轮次定位
MessageList 内按 user 消息建立轮次，收集后续 assistant 文本生成短摘要；稳定 message.id 作为定位目标。左侧窄刻度栏叠在 transcript 边缘，不另起全局 sidebar。仅观察本列表滚动/resize，根据真实行位置计算当前轮次，点击修改本列表 scrollTop，暂停自动跟随。预览为纯文本，使用现有主题，键盘focus可见，不新增 Markdown 依赖。实现归 activity_transcript，独立 TurnNavigation 组件/helper/CSS，避免重绘消息正文。

## 追加设计：错误反馈
严格校验继续拒绝非法参数，保留原始不可变arguments；工具参数错误采用结构化可序列化详情及中文字段原因，作为tool result返回模型。明确失败调用未执行，修正后须发起新调用；business_read_text提示limit<=12000及nextOffset分页。仅显示有依据的影响范围，不自动判定失败已解决。读工具参数解析失败不再被默认标高风险。UI失败详情独立可读、完成标题显示含失败，历史泛化错误可通过当前本地schema重验补充但必须标注来源。

定位栏阈值5轮，10条可见窗口；DOM可保留全部轮次按钮以简化键盘/索引，CSS限制内部视口。每项根据hover/focus索引距离生成线长，不让纯滚动引起消息正文重绘。

用户最终微调：footer背景遮罩向上延伸136px，背景模糊22px，前景控件不模糊；轮次刻度左端统一、默认含active均为6px，active仅变色，只有鼠标hover改变长度。桌面间距12px/至多120px高，手机20px/至多200px高。
