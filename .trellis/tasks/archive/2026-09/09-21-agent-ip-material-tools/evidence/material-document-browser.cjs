const { chromium } = require('/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const JSZip = require(process.cwd() + '/node_modules/jszip');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>真实素材 DOCX Worker 中文正文</w:t></w:r></w:p></w:body></w:document>');
  const docx = await zip.generateAsync({ type: 'uint8array' });
  let pdf = '%PDF-1.4\n'; const offsets = [0]; const body = 'BT /F1 12 Tf 72 720 Td (Material PDF worker text) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${body.length} >>\nstream\n${body}\nendstream`];
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;
  const browser = await chromium.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.origin); return route.abort(); }
    return route.continue();
  });
  try {
    await page.goto('http://127.0.0.1:4173/agent');
    const results = await page.evaluate(async fixtures => {
      const { db } = await import('/src/db/database.ts');
      const { createChatThread } = await import('/src/db/repo.ts');
      const { beginAgentRun } = await import('/src/db/agentRuns.ts');
      const { createFileMaterial, setMaterialArchived } = await import('/src/db/materials.ts');
      const { MATERIAL_TOOLS } = await import('/src/lib/agent/materialTools.ts');
      const thread = await createChatThread({});
      const run = await beginAgentRun({ threadId: thread.id, connector: { id: 'fixture', definitionId: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'fixture-not-real', updatedAt: '2026-09-21' }, model: 'fixture', content: '读文档' });
      const tool = MATERIAL_TOOLS.find(t => t.name === 'material_read_text');
      const rows = [];
      for (const f of fixtures) {
        const material = await createFileMaterial(new File([new Uint8Array(f.bytes)], f.name, { type: f.mime }), { kind: 'global' });
        const toolContext = { runId: run.id, threadId: thread.id, callId: `fixture-${f.name}`, signal: new AbortController().signal };
        const args = tool.parseArguments({ materialId: material.id, revision: 1 });
        try {
          const result = await tool.execute(args, toolContext);
          rows.push({ name: f.name, result });
          await setMaterialArchived(material.id, true);
          try { await tool.execute(args, toolContext); rows.at(-1).archiveBlocked = false; }
          catch { rows.at(-1).archiveBlocked = true; }
        } catch (error) { rows.push({ name: f.name, error: error.message }); }
      }
      return { rows, counts: { materials: await db.libraryMaterials.count() } };
    }, [
      { name: 'material.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: Array.from(docx) },
      { name: 'material.pdf', mime: 'application/pdf', bytes: Array.from(Buffer.from(pdf)) },
      { name: 'broken.pdf', mime: 'application/pdf', bytes: Array.from(Buffer.from('%PDF-broken')) },
    ]);
    assert(results.rows[0].result.chunks[0].text.includes('真实素材 DOCX Worker 中文正文'));
    assert.equal(results.rows[0].result.chunks[0].locator.kind, 'paragraph');
    assert(results.rows[1].result.chunks[0].text.includes('Material PDF worker text'));
    assert.equal(results.rows[1].result.chunks[0].locator.kind, 'page');
    assert(results.rows[2].error.includes('重新导出'));
    for (const row of results.rows.slice(0, 2)) { assert(row.archiveBlocked); assert.match(row.result.referenceInput.material.digest, /^[a-f0-9]{64}$/); }
    assert.deepEqual(errors, []);
    fs.writeFileSync(__dirname + '/material-document-browser.json', JSON.stringify({ ...results, errors, externalBlocked: external }, null, 2));
    console.log(JSON.stringify({ passed: true, docs: results.rows.map(row => ({ name: row.name, parsed: !!row.result, expectedError: row.error, archiveBlocked: row.archiveBlocked })), errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
