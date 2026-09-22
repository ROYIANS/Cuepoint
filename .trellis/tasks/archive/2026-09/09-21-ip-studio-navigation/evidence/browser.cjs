const {chromium}=require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out='.trellis/tasks/09-21-ip-studio-navigation/evidence',base='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 const go=async(path)=>{await page.goto(base+path);await page.locator('.studio-navigation').waitFor({state:'attached'});};
 const count=()=>page.evaluate(async()=> (await import('/src/db/database.ts')).db.projects.count());
 const active=()=>page.locator('.studio-navigation nav [aria-current="page"]').allTextContents();
 try {
 await go('/');await page.waitForURL('**/agent');assert.deepEqual(await active(),['创作助手']);checks.push('root keeps chat landing');
 for(const [path,title,label] of [['/ips','我的 IP','我的 IP'],['/assets','素材库','素材库'],['/settings','设置与帮助','设置与帮助']]) {
  await go(path);await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.deepEqual(await active(),[label]);
  await page.screenshot({path:`${out}/${path.slice(1)}-desktop.png`});
 }
 checks.push('IP/assets/settings hubs render and exclusive menu current state');
 await go('/agent/tasks');await page.locator('.agent-chat-root').waitFor();assert.deepEqual(await active(),['任务']);checks.push('task destination reuses existing task view without chat double-highlight');
 for(const path of ['/characters','/scenes','/props','/styles']) {
  await go(path);assert.deepEqual(await active(),['素材库']);await page.getByRole('navigation',{name:'素材库路径'}).getByRole('link',{name:'素材库'}).click();await page.waitForURL('**/assets');
 }
 await go('/characters/missing-fixture');await page.getByText('找不到这个角色',{exact:true}).waitFor();assert.deepEqual(await active(),['素材库']);
 checks.push('all legacy asset libraries and missing detail retain navigation and return to asset hub');
 await go('/projects');await page.getByRole('heading',{name:'项目',exact:true}).waitFor();
 const kinds=page.getByRole('group',{name:'按创作类型筛选'});
 for(const kind of ['图片','文案','播客','音乐']) {
  await kinds.getByRole('button',{name:new RegExp(kind)}).click();await page.getByRole('heading',{name:kind+'创作',exact:true}).waitFor();
  await page.getByRole('button',{name:'新建项目',exact:true}).click();const dialog=page.getByRole('dialog');
  assert(await dialog.getByRole('button',{name:'即将推出',exact:true}).isDisabled());assert.equal(await count(),0);
  await dialog.getByRole('button',{name:'关闭',exact:true}).first().click();
 }
 checks.push('all four upcoming kinds visible in filter and creation; cannot create records');
 await kinds.getByRole('button',{name:'视频',exact:true}).click();await page.getByRole('button',{name:'新建项目',exact:true}).click();
 const d=page.getByRole('dialog');await d.getByLabel('项目名称',{exact:true}).fill('   ');assert(await d.getByRole('button',{name:'创建项目',exact:true}).isDisabled());
 await d.getByLabel('项目名称',{exact:true}).fill('导航验收视频');
 await d.getByRole('button',{name:'创建项目',exact:true}).evaluate(el=>{el.click();el.click()});
 await page.waitForURL(/\/p\/.+\/e\//);assert.equal(await count(),1);checks.push('video create reaches existing episode workspace; empty names rejected; duplicate clicks create once');
 await go('/projects');await page.getByRole('button',{name:'导航验收视频',exact:true}).waitFor();
 await page.getByRole('button',{name:'导航验收视频 操作'}).click();await page.getByRole('menuitem',{name:'重命名',exact:true}).click();
 await page.getByRole('dialog').getByRole('textbox').fill('保留原有视频');await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();await page.getByRole('button',{name:'保留原有视频',exact:true}).waitFor();
 await page.getByPlaceholder('搜索…').fill('不存在的关键词');await page.getByRole('heading',{name:'没有找到匹配的项目'}).waitFor();await page.getByRole('button',{name:'清除搜索'}).click();
 await page.getByRole('button',{name:'保留原有视频',exact:true}).waitFor();await page.screenshot({path:`${out}/projects-desktop.png`});checks.push('existing video rename/search/clear and gallery preserved');
 await page.setViewportSize({width:390,height:844});
 for(const path of ['/projects','/ips','/assets','/settings']) {
  await go(path);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/${path.slice(1)}-mobile.png`});
 }
 await page.getByRole('button',{name:'打开导航'}).click();const sheet=page.getByRole('dialog');
 assert.equal(await sheet.getByRole('navigation',{name:'工作室导航'}).getByRole('link').count(),7);
 await page.screenshot({path:`${out}/menu-mobile.png`});await sheet.getByRole('link',{name:'项目',exact:true}).click();await page.waitForURL('**/projects');await sheet.waitFor({state:'hidden'});
 checks.push('390px hubs without page overflow; mobile seven-item menu navigates and closes');
 await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/音乐/}).click();
 assert(await page.getByRole('dialog').getByRole('button',{name:'即将推出',exact:true}).isDisabled());assert.equal(await count(),1);
 await page.getByRole('dialog').evaluate(el=>{el.scrollTop=0});await page.screenshot({path:`${out}/music-mobile.png`});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'新建项目',exact:true}).focus();assert(await page.getByRole('button',{name:'新建项目',exact:true}).evaluate(el=>el===document.activeElement));
 checks.push('mobile music placeholder has no writes; dialog Escape and keyboard focus work');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/browser.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
