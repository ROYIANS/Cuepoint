const assert = require("node:assert/strict");
const {
  chromium,
} = require("/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5185");
  const fixture = await page.evaluate(async () => {
    const { db } = await import("/src/db/database.ts"),
      r = await import("/src/db/repo.ts"),
      t = await import("/src/db/agentTasks.ts"),
      a = await import("/src/db/agentRuns.ts"),
      w = await import("/src/db/agentTaskWrapups.ts");
    const p = await r.createProject("复现任务"),
      task = await t.createAgentTask({
        projectId: p.id,
        title: "重写序幕",
        goal: "写剧本",
        acceptanceCriteria: [],
      });
    await new Promise((resolve) => {
      navigator.locks.request("cuepoint:agent:" + task.threadId, async () => {
        resolve();
        await new Promise((release) => {
          window.releaseFixtureLock = release;
        });
      });
    });
    const run = await a.beginAgentRun({
      threadId: task.threadId,
      connector: {
        id: "fixture",
        definitionId: "openai-compatible",
        baseUrl: "https://example.test/v1",
        apiKey: "fixture",
      },
      model: "fixture",
      content: "请开始",
    });
    const results = [];
    for (const mode of ["same", "missing-owner", "different"])
      for (const count of [1, 10, 50, 150, 500]) {
        await db.agentToolCalls.clear();
        await db.agentToolCalls.bulkPut(
          Array.from({ length: count }, (_, i) => ({
            id: "call" + i,
            providerCallId: "call" + i,
            threadId: task.threadId,
            runId: run.id,
            step: i,
            name: "business_read",
            title: "读取剧本",
            effect: "read",
            status: "completed",
            arguments: JSON.stringify({
              kind: mode === "missing-owner" ? "episode" : "project",
              id: mode === "different" ? "unknown" + i : p.id,
            }),
            result: JSON.stringify({
              kind: mode === "missing-owner" ? "episode" : "project",
              id: mode === "different" ? "unknown" + i : p.id,
            }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
        );
        try {
          await w.getTaskWrapupState(task.id);
          results.push({ mode, count, ok: true });
        } catch (e) {
          results.push({ mode, count, error: e.message, stack: e.stack });
        }
      }
    await db.agentToolCalls.clear();
    await db.agentToolCalls.bulkPut(
      Array.from({ length: 180 }, (_, i) => ({
        id: "cached-" + i,
        providerCallId: "cached-" + i,
        threadId: task.threadId,
        runId: run.id,
        step: i,
        order: 0,
        name: "business_read",
        title: "读取项目",
        effect: "read",
        highRisk: false,
        status: "completed",
        arguments: JSON.stringify({ kind: "project", id: p.id }),
        result: JSON.stringify({ kind: "project", id: p.id }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    );

    return { results, thread: task.threadId, task: task.id, run: run.id };
  });
  assert(
    fixture.results.every((item) => item.ok),
    JSON.stringify(fixture.results),
  );
  const ui = await page.context().newPage();
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.goto(`http://127.0.0.1:5185/agent/${fixture.thread}`);
  await ui.locator(".agent-composer-task-summary button").first().click();
  await ui.getByRole("heading", { name: "重写序幕", exact: true }).waitFor();
  await ui.getByRole("button", { name: "验收总结", exact: true }).click();
  await ui
    .getByText("让这次工作，有一个清晰的收尾。", { exact: true })
    .waitFor();
  await ui.getByRole("button", { name: "手动填写", exact: true }).waitFor();
  assert(
    await ui
      .getByRole("button", { name: "手动填写", exact: true })
      .isDisabled(),
  );
  // More streaming checkpoints while the inspector is visible must not interrupt the run.
  await page.evaluate(async (f) => {
    const { db } = await import("/src/db/database.ts");
    for (let i = 0; i < 5; i++)
      await db.agentRuns.update(f.run, { updatedAt: new Date().toISOString() });
  }, fixture);
  assert.equal(
    await page.evaluate(async (f) => {
      const { db } = await import("/src/db/database.ts");
      return (await db.agentRuns.get(f.run)).status;
    }, fixture),
    "running",
  );
  await ui.screenshot({ path: "/tmp/task-inspector-transaction-fixed.png" });
  await page.evaluate(async (f) => {
    const a = await import("/src/db/agentRuns.ts");
    await a.finishAgentRun(f.run, "completed", { content: "完成序幕修订" });
    window.releaseFixtureLock();
  }, fixture);
  await ui.getByRole("button", { name: "手动填写", exact: true }).click();
  await ui.getByLabel("总结", { exact: true }).fill("仍然保留的人工验收草稿");
  await ui.evaluate(async (f) => {
    const { db } = await import("/src/db/database.ts");
    const original = db.agentTasks.get.bind(db.agentTasks);
    window.restoreTaskRead = () => {
      db.agentTasks.get = original;
    };
    db.agentTasks.get = (id) =>
      id === f.task
        ? Promise.reject(new Error("fixture transient read failure"))
        : original(id);
    await db.agentTaskWrapups
      .where("taskId")
      .equals(f.task)
      .modify({ updatedAt: new Date().toISOString() });
  }, fixture);
  await ui
    .getByText("暂时无法读取验收总结。你的草稿仍保留，恢复读取后可继续保存。", {
      exact: true,
    })
    .waitFor();
  await ui.screenshot({ path: "/tmp/task-wrapup-read-error.png" });
  assert.equal(
    await ui.locator(".task-review-editor textarea").first().inputValue(),
    "仍然保留的人工验收草稿",
  );
  assert(
    await ui
      .getByRole("button", { name: "保存草稿", exact: true })
      .isDisabled(),
  );
  await ui.evaluate(() => window.restoreTaskRead());
  await ui.getByRole("button", { name: "重新读取总结", exact: true }).click();
  await ui.getByRole("button", { name: "保存草稿", exact: true }).click();
  await ui.getByText("仍然保留的人工验收草稿", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      cases: fixture.results,
      checks:
        "running task inspector, 180 repeated sources, live run checkpoints preserved, summary read failure stays local, draft retained, retry/save succeeds",
      errors,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
