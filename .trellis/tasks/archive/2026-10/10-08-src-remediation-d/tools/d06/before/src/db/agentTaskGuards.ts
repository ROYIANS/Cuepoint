import {db} from "./database";
import {isTaskBusy} from "@/lib/agent/taskState";

/** Read-only edit guard; command owners supply the transaction and perform writes. */
export async function editableAgentTask(id: string) {
    const task = await db.agentTasks.get(id);
    if (!task || !(await db.chatThreads.get(task.threadId))) throw new Error("任务或关联对话不存在");
    if (!task.projectId || !await db.projects.get(task.projectId)) throw new Error("关联项目已不存在，任务仅供查看");
    if (await db.agentTaskWrapups.where("taskId").equals(id).filter((record) => record.status === "preparing").count()) throw new Error("总结正在整理，请先等待或停止");
    const runs = await db.agentRuns.where("threadId").equals(task.threadId).toArray();
    if (isTaskBusy(runs)) throw new Error("请先处理当前执行，再修改任务");
    return task;
}
