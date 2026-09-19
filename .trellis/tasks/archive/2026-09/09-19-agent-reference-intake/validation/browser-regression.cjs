// Disposable browser profile, generated fixtures, mocked providers only.
const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let providerPosts = 0;
  await page.route('https://example.test/**', async route => {
    if (route.request().method() === 'POST') providerPosts++;
    await route.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify({data:[{id:'gpt-4o',capabilities:{vision:true},context_window:128000},{id:'gpt-3.5-turbo',capabilities:{vision:false},context_window:16384}]})});
  });
  try {
    await page.goto('http://127.0.0.1:5185/agent');
    const result = await page.evaluate(async () => {
      const { db } = await import('/src/db/database.ts');
      const repo = await import('/src/db/repo.ts');
      const imports = await import('/src/lib/references/import.ts');
      const refs = await import('/src/db/references.ts');
      const { referenceAttachment } = await import('/src/domain/references.ts');
      await db.connectors.put({id:'fixture',name:'本地验证',definitionId:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'fixture-only',updatedAt:new Date().toISOString(),models:['gpt-4o']});
      const project = await repo.createProject('参考资料 · 浏览器验证');
      const other = await repo.createProject('其他项目');
      const textFile = new File(['第一幕：海边来信\n角色小雨走进旧车站。\n第二幕：重逢。'], '剧本.md', { type: 'text/markdown' });
      const text = await imports.importReferenceFile(project.id, textFile);
      const duplicate = await imports.importReferenceFile(project.id, textFile);
      const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#153341'; ctx.fillRect(0, 0, 80, 60); ctx.fillStyle = '#ffdb8d'; ctx.fillRect(30, 10, 20, 40);
      const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const image = await imports.importReferenceFile(project.id, new File([imageBlob], '夜景参考.png', { type: 'image/png' }));
      // Minimal valid, selectable-text PDF with accurate xref offsets.
      const stream = 'BT /F1 12 Tf 72 720 Td (Reference screenplay page one) Tj ET';
      const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
      let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10,'0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const pdfRef = await imports.importReferenceFile(project.id, new File([pdf], '剧本.pdf', { type: 'application/pdf' }));
      // Load the project's installed ZIP dependency through Vite's optimized module.
      const { default: JSZip } = await import('/node_modules/.vite/deps/jszip.js');
      const zip = new JSZip();
      zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>序幕：海边的来信</w:t></w:r></w:p><w:p><w:r><w:t>小雨在车站重逢。</w:t></w:r></w:p></w:body></w:document>');
      const docxRef = await imports.importReferenceFile(project.id, new File([await zip.generateAsync({ type:'uint8array' })], '剧本.docx', { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const documents = await Promise.all([text, image, pdfRef, docxRef].map(ref => refs.getReferenceSource(project.id, referenceAttachment(ref))));
      let foreignRejected = false;
      try { await refs.getReferenceSource(other.id, referenceAttachment(text)); } catch { foreignRejected = true; }
      const search = await refs.searchProjectReferences(project.id, '小雨');
      const taskRepo = await import('/src/db/agentTasks.ts');
      const wrap = await import('/src/db/agentTaskWrapups.ts');
      const task = await taskRepo.createAgentTask({ projectId:project.id, title:'核对资料', goal:'阅读资料', plan:[] });
      await db.chatMessages.add({ id:'browser-ref-msg',threadId:task.threadId,role:'user',content:'核对剧本',attachments:Array.from({length:180},()=>referenceAttachment(text)),createdAt:new Date().toISOString() });
      const summary = await wrap.createManualWrapup(task.id);
      const before = await wrap.getTaskWrapupState(task.id);
      await refs.removeProjectReference(project.id,text.id);
      const after = await wrap.getTaskWrapupState(task.id);
      return { projectId:project.id, threadId:task.threadId, imageId:image.id, imageMediaId:image.mediaId, docxId:docxRef.id, duplicate:duplicate.id === text.id, foreignRejected, searchCount:search.length, documents:documents.map(d=>({kind:d.reference.kind,status:d.reference.status,text:d.chunks.map(c=>c.text).join('\n'),warnings:d.reference.warnings})), snapshotCount:summary.snapshot.evidence.filter(e=>e.kind==='reference').length,beforeStale:before.stale,afterStale:after.stale };
    });
    assert.equal(result.duplicate,true); assert.equal(result.foreignRejected,true); assert(result.searchCount>=2);
    assert.deepEqual(result.documents.map(d=>d.kind),['text','image','pdf','docx']);
    assert(result.documents[0].text.includes('小雨')); assert(result.documents[2].text.includes('Reference screenplay')); assert(result.documents[3].text.includes('小雨'));
    assert.equal(result.snapshotCount,1); assert.equal(result.beforeStale,false); assert.equal(result.afterStale,true);
    const wire = await page.evaluate(async ({projectId,imageId,imageMediaId,docxId}) => {
      const {db} = await import('/src/db/database.ts');
      const repo = await import('/src/db/repo.ts');
      const {beginAgentRun} = await import('/src/db/agentRuns.ts');
      const {executeChatRun} = await import('/src/lib/agent/runChat.ts');
      const connector = await db.connectors.get('fixture');
      const source = await db.media.get(imageMediaId);
      const generatedId = 'generated-fixture';
      await db.media.put({...source,id:generatedId,filename:'生成的夜景.png'});
      const outcomes = [];
      for (const model of ['gpt-4o','gpt-5.6-luna']) for (const toolRead of [false,true]) {
        const thread = await repo.createChatThread({projectId});
        const run = await beginAgentRun({threadId:thread.id,connector,model,content:toolRead?'请查看生成图':'分析图与剧本',attachments:toolRead?[]:[{referenceId:imageId,revision:1},{referenceId:docxId,revision:1}],modelMetadata:{vision:true,contextWindowTokens:128000}});
        const requests = [];
        await executeChatRun(run,connector.apiKey,new AbortController(),async(url,init)=>{
          const body = JSON.parse(init.body); requests.push({url,body});
          const wantTool = toolRead && requests.length === 1;
          if (run.protocol === 'responses') return Response.json({id:'resp-fixture-'+requests.length,status:'completed',output:wantTool?[{type:'function_call',id:'item1',call_id:'image-call',name:'read_project_image',arguments:JSON.stringify({mediaId:generatedId}),status:'completed'}]:[{type:'message',id:'answer'+requests.length,role:'assistant',status:'completed',content:[{type:'output_text',text:'已收到图片，以下为测试回答。'}]}]});
          return Response.json({choices:[{message:wantTool?{content:'',tool_calls:[{id:'image-call',type:'function',function:{name:'read_project_image',arguments:JSON.stringify({mediaId:generatedId})}}]}:{content:'已收到图片，以下为测试回答。'},finish_reason:wantTool?'tool_calls':'stop'}]});
        });
        const final = await db.agentRuns.get(run.id);
        const payload = requests.at(-1)?.body;
        const serialized = JSON.stringify(payload);
        const calls = await db.agentToolCalls.where('runId').equals(run.id).toArray();
        outcomes.push({model,protocol:run.protocol,toolRead,status:final.status,error:final.error,requestCount:requests.length,pixels:serialized.includes('data:image/png;base64,'),document:serialized.includes('小雨'),imagesUseSelectedModel:requests.every(r=>r.body.model===model),noPersistedBase64:!JSON.stringify(final).includes('data:image'),paired:!toolRead || calls.length===1&&calls[0].status==='completed',auditSteps:final.referenceAudit?.length,firstHasNoImage:!JSON.stringify(requests[0]?.body).includes('data:image/png;base64,')});
      }
      return outcomes;
    },result);
    for (const row of wire) {
      assert.equal(row.status,'completed',JSON.stringify(row)); assert.equal(row.requestCount,row.toolRead?2:1,JSON.stringify(row)); assert(row.pixels,JSON.stringify(row)); assert(row.imagesUseSelectedModel); assert(row.noPersistedBase64); assert(row.paired); if(row.toolRead)assert(row.firstHasNoImage); else assert(row.document);
    }
    console.log('Actual native browser wire checks:',JSON.stringify(wire,null,2));
    await page.goto(`http://127.0.0.1:5185/agent/${result.threadId}`);
    await page.getByRole('button',{name:'更多选项',exact:true}).click();
    await page.waitForTimeout(250);
    await page.screenshot({animations:'disabled',path:'/tmp/reference-intake-menu.png'});
    await page.getByRole('menuitem',{name:/项目资料/}).click();
    await page.getByRole('heading',{name:'项目资料',exact:true}).waitFor();
    await page.getByRole('textbox',{name:'搜索项目资料'}).fill('docx');
    await page.getByRole('button',{name:'附加 剧本.docx',exact:true}).click();
    await page.getByRole('button',{name:'剧本.docx',exact:true}).first().click();
    await page.getByRole('heading',{name:'来源资料',exact:true}).waitFor();
    assert((await page.locator('.reference-preview').innerText()).includes('小雨'));
    await page.waitForTimeout(250);
    await page.screenshot({animations:'disabled',path:'/tmp/reference-intake-document.png'});
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'来源资料',exact:true}).waitFor({state:'hidden'});
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'项目资料',exact:true}).waitFor({state:'hidden'});
    assert.equal(await page.locator('.agent-composer .reference-chip').count(),1);
    await page.getByRole('button',{name:'从消息中移除附件',exact:true}).click();
    assert.equal(await page.locator('.agent-composer .reference-chips').count(),0);
    await page.locator('input[type=file]').setInputFiles({name:'新剧本.txt',mimeType:'text/plain',buffer:Buffer.from('第三幕：海边的一封信。')});
    await page.locator('.agent-composer .reference-chip').getByRole('button',{name:'新剧本.txt',exact:true}).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({animations:'disabled',path:'/tmp/reference-intake-composer.png'});
    await page.getByRole('button',{name:'上下文明细',exact:true}).click();
    await page.getByText(/本次消息参考资料/).click();
    assert((await page.getByRole('region',{name:'上下文明细'}).innerText()).includes('新剧本.txt'));
    await page.keyboard.press('Escape');
    await page.getByRole('region',{name:'上下文明细'}).waitFor({state:'hidden'});
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'更多选项',exact:true}).click();
    await page.getByRole('menuitem',{name:/项目资料/}).click();
    await page.getByRole('heading',{name:'项目资料',exact:true}).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({animations:'disabled',path:'/tmp/reference-intake-mobile.png'});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('http://127.0.0.1:5185/agent');
    await page.getByRole('button',{name:'选择项目',exact:true}).click();
    await page.getByRole('option',{name:'参考资料 · 浏览器验证',exact:true}).click();
    await page.getByRole('button',{name:'选择模型',exact:true}).click();
    await page.locator('.agent-model-row').filter({hasText:'gpt-3.5-turbo'}).click();
    await page.locator('textarea.agent-composer-input').fill('保留这份尚未发送的图片草稿');
    await page.getByRole('button',{name:'更多选项',exact:true}).click();
    await page.getByRole('menuitem',{name:/项目资料/}).click();
    await page.getByRole('button',{name:'附加 夜景参考.png',exact:true}).click();
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'项目资料',exact:true}).waitFor({state:'hidden'});
    await page.locator('.agent-composer-send').click();
    await page.getByText('当前模型不支持图片输入，请切换到支持视觉的模型，或移除图片后发送',{exact:true}).waitFor();
    assert.match(page.url(),/agent\/cth_/);
    assert.equal(await page.locator('textarea.agent-composer-input').inputValue(),'保留这份尚未发送的图片草稿');
    assert.equal(await page.locator('.agent-composer .reference-chip').count(),1);
    assert.equal(providerPosts,0,'Unsupported image sends must not call a provider');
    console.log('UI: source preview, chips, context preview, narrow library, and home-to-thread vision rejection preserve draft: PASS');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result,null,2));
  } catch(error) { await page.waitForTimeout(250);
    await page.screenshot({animations:'disabled',path:'/tmp/reference-intake-failure.png'}); console.log('FAILURE BODY', (await page.locator('body').innerText()).slice(-5000)); throw error; } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
