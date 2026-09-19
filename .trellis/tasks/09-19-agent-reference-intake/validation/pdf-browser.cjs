const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
execFileSync('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3', [__dirname + '/pdf-fixtures.py']);
(async () => {
  const browser = await chromium.launch({ executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless:true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5185/agent');
    const fixtures = ['chinese','scan','mixed','password','corrupt'].map(name => ({name, bytes:[...fs.readFileSync('/tmp/reference-intake-pdf-fixtures/'+name+'.pdf')]}));
    const rows = await page.evaluate(async fixtures => {
      const { createProject } = await import('/src/db/repo.ts');
      const { importReferenceFile } = await import('/src/lib/references/import.ts');
      const { getReferenceSource } = await import('/src/db/references.ts');
      const project = await createProject('PDF regression');
      const results = [];
      for (const {name, bytes} of fixtures) {
        const ref = await importReferenceFile(project.id, new File([new Uint8Array(bytes)],name+'.pdf',{type:'application/pdf'}));
        const source = ['ready','partial'].includes(ref.status) ? await getReferenceSource(project.id,{referenceId:ref.id,revision:ref.revision}) : null;
        results.push({name,status:ref.status,coverage:ref.coverage,error:ref.error,text:source?.chunks.map(c=>c.text).join('\n'),warnings:ref.warnings});
      }
      return results;
    },fixtures);
    assert.equal(rows[0].status,'ready'); assert(rows[0].text.includes('小雨'));
    assert.equal(rows[1].status,'failed'); assert(rows[1].error.includes('扫描'));
    assert.equal(rows[2].status,'partial'); assert.deepEqual(rows[2].coverage.emptyUnits,[2]); assert(rows[2].text.includes('小雨'));
    assert.equal(rows[3].status,'failed'); assert(rows[3].error.includes('密码'));
    assert.equal(rows[4].status,'failed'); assert(rows[4].error.includes('重新导出'));
    console.log(JSON.stringify(rows,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
