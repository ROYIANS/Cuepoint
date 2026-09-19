// Isolated disposable Edge + local mocked transport. No provider network requests.
const {
  chromium,
} = require("/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert = require("node:assert/strict");
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5185");
  const f = await page.evaluate(async () => {
    const r = await import("/src/db/repo.ts"),
      t = await import("/src/db/agentTasks.ts"),
      w = await import("/src/db/agentTaskWrapups.ts"),
      m = await import("/src/db/projectMemories.ts"),
      a = await import("/src/db/agentRuns.ts"),
      c = await import("/src/lib/agent/runChat.ts"),
      { db } = await import("/src/db/database.ts");
    const project = await r.createProject("海边的来信"),
      other = await r.createProject("无关项目");
    const task = await t.createAgentTask({
      projectId: project.id,
      title: "第一幕创作复盘",
      goal: "确认夜景色彩与镜头节奏",
      acceptanceCriteria: [],
    });
    const draft = await w.createManualWrapup(task.id),
      saved = await w.saveWrapup(
        task.id,
        draft.id,
        {
          ...draft.content,
          overview: "镜头与叙事方向已核对。",
          lessons: [
            {
              text: "雨夜镜头先确认人物动作与节奏，再生成素材。",
              sourceIds: [],
            },
          ],
        },
        draft.revision,
      ),
      confirmed = await w.confirmWrapup(task.id, saved.id, saved.revision);
    const memory = (
      await m.promoteProjectMemory(
        project.id,
        {
          taskId: task.id,
          summaryId: confirmed.id,
          summaryRevision: confirmed.revision,
          itemKind: "lesson",
          itemIndex: 0,
          itemText: confirmed.content.lessons[0].text,
        },
        {
          category: "lesson",
          title: "雨夜镜头的生成顺序",
          topicKey: "rain",
          body: confirmed.content.lessons[0].text,
          applicability: "雨夜镜头与人物动作创作",
          tags: ["雨夜", "镜头"],
        },
      )
    ).memory;
    const wide = (
      await m.createProjectMemory(project.id, {
        inclusion: "project",
        category: "convention",
        title: "为字幕保留画面空间",
        topicKey: "safe-zone",
        body: "画面底部保留字幕安全区，重要信息不要贴近边缘。",
        applicability: "项目所有画面",
        tags: ["构图"],
      })
    ).memory;
    await m.createProjectMemory(other.id, {
      inclusion: "project",
      category: "lesson",
      title: "FOREIGN_ONLY",
      topicKey: "foreign",
      body: "FOREIGN_ONLY",
      applicability: "全部",
      tags: [],
    });
    const thread = await r.createChatThread({ projectId: project.id });
    const connector = {
      id: "fixture",
      definitionId: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKey: "fixture-only",
      updatedAt: new Date().toISOString(),
    };
    await db.connectors.put(connector);
    const run = await a.beginAgentRun({
      threadId: thread.id,
      connector,
      model: "fixture-model",
      content: "请创作雨夜镜头",
      interactionMode: "conversation",
    });
    let payload;
    await c.executeChatRun(
      run,
      connector.apiKey,
      new AbortController(),
      async (_url, init) => {
        payload = JSON.parse(init.body);
        return Response.json({
          choices: [
            {
              message: {
                content: "先确定动作和镜头节奏，再为画面预留字幕空间。",
              },
              finish_reason: "stop",
            },
          ],
        });
      },
    );
    const finished = await db.agentRuns.get(run.id);
    return {
      project: project.id,
      other: other.id,
      thread: thread.id,
      run: run.id,
      memory: memory.id,
      wide: wide.id,
      payload,
      audit: finished.memoryAudit,
    };
  });
  assert.equal(f.audit.length, 1);
  assert.equal(f.audit[0].selection.entries.length, 2);
  assert(JSON.stringify(f.payload).includes("雨夜镜头先确认"));
  assert(!JSON.stringify(f.payload).includes("FOREIGN_ONLY"));
  await page.goto(`http://127.0.0.1:5185/agent/${f.thread}`);
  await page.getByRole("button", { name: "查看本次请求的记忆" }).click();
  await page
    .getByRole("heading", { name: /这次带入的记忆|下次引用的记忆/ })
    .waitFor();
  assert.equal(await page.locator(".memory-context-entry").count(), 2);
  await page.screenshot({ path: "/tmp/memory-retrieval-history.png" });
  await page
    .getByRole("button", { name: "本对话排除", exact: true })
    .last()
    .click();
  await page.getByRole("heading", { name: "本对话已排除 1" }).waitFor();
  assert.equal(await page.locator(".memory-context-entry").count(), 2); // audit unchanged
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "上下文明细", exact: true }).click();
  await page.getByRole("button", { name: /项目记忆 · 1 条/ }).waitFor();
  await page.getByRole("button", { name: /项目记忆 · 1 条/ }).click();
  await page
    .getByRole("heading", { name: /这次带入的记忆|下次引用的记忆/ })
    .waitFor();
  assert.equal(await page.locator(".memory-context-entry").count(), 1);
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.locator(".memory-context-entry").nth(1).waitFor();
  await page.screenshot({ path: "/tmp/memory-retrieval-preview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/memory-retrieval-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async (f) => {
    const m = await import("/src/db/projectMemories.ts");
    const row = await m.getProjectMemory(f.project, f.memory);
    await m.updateProjectMemory(
      f.project,
      f.memory,
      {
        category: row.category,
        title: row.title,
        topicKey: row.topicKey,
        body: "修订后的顺序：先验证动作连续性，再安排雨夜镜头。",
        applicability: row.applicability,
        tags: row.tags,
        inclusion: row.inclusion,
      },
      row.revision,
    );
  }, f);
  await page.getByRole("button", { name: "查看本次请求的记忆" }).click();
  await page.getByText(/当前为版本 2/).waitFor();
  assert(
    await page
      .locator(".memory-context-body")
      .last()
      .textContent()
      .then((s) => s.includes("先确认人物动作")),
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "上下文明细", exact: true }).click();
  await page.getByRole("button", { name: /项目记忆 · 2 条/ }).click();
  await page
    .getByText("修订后的顺序：先验证动作连续性，再安排雨夜镜头。", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("link", { name: "查看记忆与来源 ↗" }).last().click();
  await page.getByRole("button", { name: "编辑这条记忆" }).click();
  await page.getByLabel("引用方式", { exact: true }).selectOption("project");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(async (f) => {
      const m = await import("/src/db/projectMemories.ts");
      return (await m.getProjectMemory(f.project, f.memory)).inclusion;
    }, f),
    "project",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      checks:
        "confirmed task A → project memory → thread B mocked HTTP; project C excluded; historical audit; thread exclusion/restoration; next preview; old snapshot vs edited version; reload; source navigation; inclusion editor; Escape/mobile",
      errors,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
