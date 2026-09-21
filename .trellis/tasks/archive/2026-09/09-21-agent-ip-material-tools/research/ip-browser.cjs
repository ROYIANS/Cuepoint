const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page = await context.newPage(); page.setDefaultTimeout(20000);
 const errors=[]; page.on('pageerror', e=>errors.push(e.message)); const requests=[];
 await page.route('https://ip-fixture.test/**',async route=>{
  if(route.request().method()==='GET') return route.fulfill({json:{data:[{id:'gpt-4.1'}]}});
  const body=JSON.parse(route.request().postData()); requests.push(body);
  const tools=body.tools.map(t=>t.function.name);
  let call;
  if(requests.length===1){assert(tools.includes('load_tool_groups'));assert(!tools.includes('ip_create'));call=['load_tool_groups',{groupIds:['ip-management']}];}
  else if(requests.length===2){assert(tools.includes('ip_create'));call=['ip_create',{name:'INFP 美食博主',positioning:'用一人食记录温柔生活',audience:'喜欢独处与家常料理的年轻人',topics:'一人食、周末菜市场',expression:'温柔克制，真实分享',visual:'自然光与暖色',voice:'舒缓自然'}];}
  if(call)return route.fulfill({json:{choices:[{message:{role:'assistant',content:'',tool_calls:[{id:'fixture-'+requests.length,type:'function',function:{name:call[0],arguments:JSON.stringify(call[1])}}]},finish_reason:'tool_calls'}]}});
  return route.fulfill({json:{choices:[{message:{role:'assistant',content:'已建立 INFP 美食博主 IP，档案已保存。'},finish_reason:'stop'}]}});
 });
 await page.goto('http://127.0.0.1:4173/agent');
 await page.evaluate(async()=>{const{db}=await import('/src/db/database.ts');await db.connectors.put({id:'ip-fixture',name:'本地测试',definitionId:'openai-compatible',baseUrl:'https://ip-fixture.test/v1',apiKey:'fixture',updatedAt:new Date().toISOString()});await(await import('/src/db/agentSettings.ts')).updateGeneralAgentConfig({permissionMode:'full'});});
 try {
 await page.getByRole('button',{name:'选择模型',exact:true}).click();
 await page.getByRole('button').filter({hasText:'GPT-4.1'}).last().click();
 await page.locator('textarea.agent-composer-input').fill('帮我建立一个 INFP 美食博主 IP，请将这些定位整理成确认卡。');
 await page.locator('textarea.agent-composer-input').press('Enter');
 await page.getByRole('button',{name:'查看并决定：创建 IP 档案',exact:true}).click();
 await page.getByRole('button',{name:'批准此次操作',exact:true}).waitFor();
 const text=await page.locator('body').innerText();assert(text.includes('定位：用一人食记录温柔生活'));assert(text.includes('声音偏好：舒缓自然'));
 assert.equal(await page.evaluate(async()=>await(await import('/src/db/database.ts')).db.ipProfiles.count()),0);
 await page.screenshot({path:'.trellis/tasks/09-21-agent-ip-material-tools/research/ip-confirmation.png'});
 await page.getByRole('button',{name:'上下文明细',exact:true}).click();
 const panel=await page.locator('body').innerText();assert(panel.includes('IP 档案'));
 await page.screenshot({path:'.trellis/tasks/09-21-agent-ip-material-tools/research/ip-context-usage.png'});
 await page.getByRole('button',{name:'关闭上下文明细',exact:true}).click();
 await page.getByRole('button',{name:'批准此次操作',exact:true}).click();
 await page.getByText('已建立 INFP 美食博主 IP，档案已保存。',{exact:true}).waitFor();
 const ips=await page.evaluate(async()=>await(await import('/src/db/database.ts')).db.ipProfiles.toArray());assert.equal(ips.length,1);assert.equal(ips[0].positioning,'用一人食记录温柔生活');
 await page.goto('http://127.0.0.1:4173/ips/'+ips[0].id);await page.getByText('INFP 美食博主',{exact:true}).first().waitFor();
 await page.screenshot({path:'.trellis/tasks/09-21-agent-ip-material-tools/research/ip-created.png'});
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync('.trellis/tasks/09-21-agent-ip-material-tools/research/ip-browser.json',JSON.stringify({passed:true,requestToolCounts:requests.map(r=>r.tools.length),requests:requests.length,profile:{name:ips[0].name,positioning:ips[0].positioning},pageErrors:errors},null,2));
 console.log('PASS IP discovery -> full-mode confirmation -> persisted IP -> final response; context panel visible.', requests.map(r=>r.tools.length));
 } catch(e) {console.log(await page.locator('body').innerText(),errors,requests.length);throw e;} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
