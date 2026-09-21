const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
const out = '.trellis/tasks/archive/2026-09/09-21-audit-remediation/evidence';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:4173/projects');
    const f = await page.evaluate(async () => {
      const r = await import('/src/db/repo.ts'), db = (await import('/src/db/database.ts')).db;
      const p = await r.createProject('UI 修复回归'), e = await r.firstEpisode(p.id);
      await r.addShots(p.id, e.id, 1000);
      await r.setVisibleColumns(p.id, ['content','durationSec','notes']);
      return { p: p.id, e: e.id, shots: await db.shots.where('episodeId').equals(e.id).sortBy('order') };
    });
    const target = `http://127.0.0.1:4173/p/${f.p}/e/${f.e}/shots`;
    await page.goto(target);
    const first = page.locator('#shot-' + f.shots[0].id);
    await first.getByLabel('时长（秒）').waitFor();
    const duration = first.getByLabel('时长（秒）');
    await duration.fill(''); await duration.pressSequentially('1.5', { delay: 100 });
    assert.equal(await duration.inputValue(), '1.5');
    await duration.press('Tab');
    await page.waitForFunction(async id => (await (await import('/src/db/database.ts')).db.shots.get(id)).durationSec === 1.5, f.shots[0].id);
    for (const raw of ['0', '.5', '12.25', '']) {
      await duration.fill(raw); await duration.press('Tab');
      await page.waitForFunction(async ({id,expected}) => (await (await import('/src/db/database.ts')).db.shots.get(id)).durationSec === expected, {id:f.shots[0].id,expected:raw === '' ? 0 : Number(raw)});
    }
    await page.evaluate(async () => {
      const db = (await import('/src/db/database.ts')).db;
      window.__durationFailure = true;
      db.shots.hook('updating', mods => { if (window.__durationFailure && 'durationSec' in mods) throw new Error('测试写入失败'); });
    });
    await duration.fill('7.75'); await duration.press('Tab');
    await first.getByRole('alert').waitFor();
    assert.equal(await duration.inputValue(), '7.75');
    await page.evaluate(() => { window.__durationFailure = false; });
    await first.getByRole('button', { name: '重试', exact: true }).click();
    await page.waitForFunction(async id => (await (await import('/src/db/database.ts')).db.shots.get(id)).durationSec === 7.75, f.shots[0].id);
    checks.push({ name: 'duration save failure survives blur and explicit retry persists it', passed: true });
    checks.push({ name: 'duration typing, zero, pasted fractional value, clear persisted', passed: true });
    const copy = first.getByRole('button', { name: '复制镜头', exact: true });
    await copy.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(async id => (await (await import('/src/db/database.ts')).db.shots.where('episodeId').equals(id).count()) === 1001, f.e);
    checks.push({ name: 'native button Space activates copy exactly once', passed: true });
    // The keyboard sensor receives Space and arrows even though it is inside the shot workspace.
    const drag = first.getByRole('button', { name: '拖拽调整镜头顺序', exact: true });
    await drag.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
    await page.waitForFunction(async id => (await (await import('/src/db/database.ts')).db.shots.get(id)).order > 0, f.shots[0].id);
    checks.push({ name: 'dnd keyboard sensor receives Space / ArrowDown / Space', passed: true });
    const mounted = await page.locator('[data-shot-mounted="true"]').count();
    assert(mounted < 30, 'bounded mounted controls');
    checks.push({ name: '1001 shot list keeps anchors but bounds rendered controls', anchors: await page.locator('[data-shot-mounted]').count(), mounted, dom: await page.locator('*').count() });
    await page.goto(target + '?shot=' + f.shots[999].id);
    const last = page.locator('#shot-' + f.shots[999].id);
    await last.getByLabel('镜号', { exact: true }).waitFor();
    await page.waitForFunction(id => { const r=document.getElementById('shot-'+id).getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, f.shots[999].id).catch(async error => { console.log('LOCATE',await last.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),scroll:el.closest('[data-shot-scrollport]').scrollTop}))); throw error; });
    await last.getByPlaceholder('镜头内容').fill('末尾定位后的编辑');
    await page.waitForFunction(async id => (await (await import('/src/db/database.ts')).db.shots.get(id)).content === '末尾定位后的编辑', f.shots[999].id);
    checks.push({ name: 'deep link materializes last row, scrolls and persists edit', passed: true });
    await page.screenshot({ path: out + '/shot-window-last.png' });
    // Focus a placeholder directly as the browser does when Tab reaches it.
    await page.goto(target);
    const midId = f.shots[500].id;
    assert.equal(await page.locator('#shot-' + midId).getAttribute('data-shot-mounted'), 'false');
    await page.locator('#shot-' + midId).focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.closest('[id^="shot-"]')?.id), 'shot-' + midId);
    checks.push({ name: 'Tab enters controls after focusing an unmounted row placeholder', passed: true });
    // Drag across a scroll boundary to a row whose controls were initially unmounted.
    await page.goto(target);
    await first.getByRole('button', { name: '拖拽调整镜头顺序', exact: true }).waitFor();
    const handle = first.getByRole('button', { name: '拖拽调整镜头顺序', exact: true });
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 + 15, { steps: 5 });
    await page.locator('[data-shot-scrollport]').evaluate(el => { el.scrollTop = 1700; });
    const dest = page.locator('#shot-' + f.shots[12].id);
    await dest.getByLabel('镜号', { exact: true }).waitFor();
    const destBox = await dest.boundingBox();
    await page.mouse.move(box.x + box.width / 2, destBox.y + 60, { steps: 10 });
    await page.waitForTimeout(150); await page.mouse.up();
    await page.waitForFunction(async id => (await (await import('/src/db/database.ts')).db.shots.get(id)).order >= 10, f.shots[0].id);
    checks.push({ name: 'pointer drag across scroll boundary reorders against initially unmounted row', passed: true });
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/ui-browser.json', JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify(checks, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
