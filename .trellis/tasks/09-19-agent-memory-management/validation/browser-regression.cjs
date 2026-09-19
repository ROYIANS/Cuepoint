// Disposable Edge profile; fixture-only data. Start local Vite on port 5185.
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
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGEERROR", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });
  await page.goto("http://127.0.0.1:5185");
  const fixture = await page.evaluate(async () => {
    const r = await import("/src/db/repo.ts"),
      t = await import("/src/db/agentTasks.ts"),
      w = await import("/src/db/agentTaskWrapups.ts"),
      m = await import("/src/db/projectMemories.ts");
    const project = await r.createProject("海边的来信");
    const task = await t.createAgentTask({
      projectId: project.id,
      title: "第一幕创作复盘",
      goal: "确认叙事与色彩方向",
      acceptanceCriteria: [],
    });
    const draft = await w.createManualWrapup(task.id),
      saved = await w.saveWrapup(
        task.id,
        draft.id,
        {
          ...draft.content,
          overview: "第一幕创作已核对。",
          decisions: [
            {
              text: "回忆场景采用低饱和暖色，现实场景保持中性色。",
              sourceIds: [],
            },
          ],
          lessons: [
            {
              text: "先确认镜头节奏与人物动作，再进入素材生成。",
              sourceIds: [],
            },
          ],
        },
        draft.revision,
      );
    const review = await w.confirmWrapup(task.id, saved.id, saved.revision);
    const memory = (
      await m.createProjectMemory(project.id, {
        category: "preference",
        title: "保留对白里的停顿",
        topicKey: "dialogue",
        body: "人物表达犹豫时，用动作和停顿传达情绪，避免在对白里解释所有动机。\n关键转折前，为观众保留理解人物的空间。",
        applicability:
          "适用于主角与父亲的重逢场景；紧急行动场景可提高对白密度。",
        tags: ["对白", "人物"],
      })
    ).memory;
    return {
      project: project.id,
      task: task.id,
      thread: task.threadId,
      memory: memory.id,
      review: review.id,
    };
  });
  await page.goto(`http://127.0.0.1:5185/p/${fixture.project}/memory`);
  await page.getByRole("button", { name: /保留对白里的停顿/ }).click();
  await page.screenshot({ path: "/tmp/memory-desktop.png" });
  await page.getByRole("button", { name: "编辑这条记忆" }).click();
  await page.getByLabel("记忆正文", { exact: true }).fill("当前页面保留的草稿");
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
        body: "另一处提交的版本",
        applicability: row.applicability,
        tags: row.tags,
      },
      row.revision,
    );
  }, fixture);
  await page.getByText("这条记忆已在其他地方更新").waitFor();
  if (
    (await page.getByLabel("记忆正文", { exact: true }).inputValue()) !==
    "当前页面保留的草稿"
  )
    throw Error("draft lost");
  await page
    .getByRole("button", { name: "已核对最新版本，保留我的草稿继续编辑" })
    .click();
  await page.evaluate(async (f) => {
    const { db } = await import("/src/db/database.ts");
    const original = db.projectMemories.get.bind(db.projectMemories);
    window.restoreMemoryRead = () => {
      db.projectMemories.get = original;
    };
    db.projectMemories.get = () =>
      Promise.reject(new Error("fixture read failure"));
    await db.projectMemories.update(f.memory, {
      updatedAt: new Date().toISOString(),
    });
  }, fixture);
  await page.getByText(/暂时无法读取记忆/).waitFor();
  if (
    (await page.getByLabel("记忆正文", { exact: true }).inputValue()) !==
    "当前页面保留的草稿"
  )
    throw Error("read failure lost draft");
  await page.evaluate(() => window.restoreMemoryRead());
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "停用记忆", exact: true }).click();
  await page.getByRole("button", { name: "重新启用", exact: true }).click();
  await page.getByRole("button", { name: "添加记忆", exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill("还没写完");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("alertdialog").waitFor();
  await page.getByRole("button", { name: "继续编辑" }).click();
  if (
    (await page.getByLabel("标题", { exact: true }).inputValue()) !== "还没写完"
  )
    throw Error("discard lost");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  await page.goto(`http://127.0.0.1:5185/agent/${fixture.thread}`);
  await page
    .getByRole("button", { name: "整理目标与清单", exact: true })
    .click();
  await page.getByRole("button", { name: "验收总结", exact: true }).click();
  await page.getByRole("button", { name: "存为项目记忆" }).last().click();
  await page
    .getByLabel("记忆正文", { exact: true })
    .fill("确认节奏再生成，避免重复付费。");
  await page.evaluate(async (f) => {
    const w = await import("/src/db/agentTaskWrapups.ts");
    await w.createManualWrapup(f.task);
  }, fixture);
  await page.waitForTimeout(300);
  if (
    (await page.getByLabel("记忆正文", { exact: true }).inputValue()) !==
    "确认节奏再生成，避免重复付费。"
  )
    throw Error("source refresh lost draft");
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await page.getByRole("link", { name: /查看“/ }).click();
  await page
    .getByRole("heading", {
      name: "先确认镜头节奏与人物动作，再进入素材生成。",
    })
    .last()
    .waitFor();
  await page.evaluate(async (f) => {
    const r = await import("/src/db/repo.ts");
    await r.deleteChatThread(f.thread);
  }, fixture);
  await page
    .getByText("原任务、对话或已确认版本不可用；已保留来源摘录")
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/memory-mobile.png" });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("horizontal overflow");
  await page.getByRole("button", { name: "返回列表" }).click();
  await page.getByRole("button", { name: "添加记忆", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const imported = await page.evaluate(async (f) => {
    const m = await import("/src/db/projectMemories.ts"),
      p = await import("/src/lib/projectPackage.ts");
    const old = (
      await m.createProjectMemory(f.project, {
        category: "convention",
        title: "镜头色彩旧约定",
        topicKey: "palette",
        body: "夜景使用蓝色",
        applicability: "夜景",
        tags: [],
      })
    ).memory;
    await m.createProjectMemory(
      f.project,
      {
        category: "convention",
        title: "镜头色彩新约定",
        topicKey: "palette",
        body: "夜景改用暖色",
        applicability: "夜景",
        tags: [],
      },
      { replace: { id: old.id, expectedRevision: old.revision } },
    );
    return await p.importProjectZip(await p.exportProjectZip(f.project));
  }, fixture);

  const importedId = typeof imported === "string" ? imported : imported.id;
  await page.goto(`http://127.0.0.1:5185/p/${importedId}/memory`);
  await page.getByRole("button", { name: /镜头色彩旧约定/ }).click();
  await page.getByRole("button", { name: "确认并启用", exact: true }).click();
  await page.getByRole("button", { name: /镜头色彩新约定/ }).click();
  await page.getByRole("button", { name: "确认并启用", exact: true }).click();
  await page
    .getByRole("button", { name: "以当前记忆替代此条", exact: true })
    .click();
  await page.getByRole("button", { name: "停用记忆", exact: true }).waitFor();
  await page.getByRole("button", { name: "删除这条记忆", exact: true }).click();
  await page.getByRole("button", { name: "永久删除", exact: true }).click();
  await page
    .getByRole("heading", { name: "项目的创作共识", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /镜头色彩旧约定/ }).click();
  await page.getByText("此条目已被新记忆替代，保留作为历史依据。").waitFor();
  await page.getByRole("button", { name: "添加记忆", exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill("路由保护草稿");
  await page.evaluate(() =>
    document.querySelector('a[href$="/world"]').click(),
  );
  await page.getByRole("alertdialog").waitFor();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  if (
    (await page.getByLabel("标题", { exact: true }).inputValue()) !==
    "路由保护草稿"
  )
    throw Error("navigation lost draft");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  await page.getByText("已被替代", { exact: true }).last().waitFor();
  await page.mouse.move(20, 20);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "/tmp/memory-import-desktop.png" });
  console.log(
    JSON.stringify({
      fixture,
      errors,
      checks:
        "desktop, CAS reconcile, storage read failure preserves draft and retry, disable/reactivate, dirty close/navigation, summary refresh draft, promotion deep-link, missing source, mobile/keyboard, ZIP review, conflict replacement, hard delete passed",
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
