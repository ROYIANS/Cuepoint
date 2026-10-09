import ts from 'typescript';
import path from 'node:path';
import { relative } from './shared.mjs';

function staticImportIsType(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return false;
    if (clause.isTypeOnly) return true;
    if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) return false;
    return clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(item => item.isTypeOnly);
  }
  if (ts.isExportDeclaration(node)) return node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly));
  return Boolean(node.isTypeOnly);
}
function stronglyConnected(files, edges) {
  const adjacency = new Map(files.map(file => [file, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const index = new Map(), low = new Map(), stack = [], active = new Set(), cycles = [];
  let next = 0;
  function visit(file) {
    index.set(file, next); low.set(file, next++); stack.push(file); active.add(file);
    for (const target of adjacency.get(file) ?? []) {
      if (!index.has(target)) { visit(target); low.set(file, Math.min(low.get(file), low.get(target))); }
      else if (active.has(target)) low.set(file, Math.min(low.get(file), index.get(target)));
    }
    if (low.get(file) === index.get(file)) {
      const members = [];
      let current;
      do { current = stack.pop(); active.delete(current); members.push(current); } while (current !== file);
      if (members.length > 1 || adjacency.get(file)?.includes(file)) cycles.push(members.sort());
    }
  }
  files.forEach(file => { if (!index.has(file)) visit(file); });
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}
export async function checkArchitecture(root) {
  const configFile = path.join(root, 'tsconfig.app.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configFile);
  if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, { getCurrentDirectory: () => root, getCanonicalFileName: value => value, getNewLine: () => '\n' }));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const sources = program.getSourceFiles().filter(source => {
    const file = relative(root, source.fileName);
    return file.startsWith('src/') && /\.[cm]?tsx?$/.test(file) && !source.isDeclarationFile;
  });
  const files = sources.map(source => relative(root, source.fileName)).sort();
  const owned = new Set(files);
  const edges = [], computed = [], unresolved = [], shadowedRequires = [];
  const resolutionCache = ts.createModuleResolutionCache(root, value => value, parsed.options);
  for (const source of sources) {
    const from = relative(root, source.fileName);
    function add(node, literal, kind, typeOnly) {
      const specifier = literal.text;
      const resolution = ts.resolveModuleName(specifier, source.fileName, parsed.options, ts.sys, resolutionCache).resolvedModule;
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (!resolution) { unresolved.push({ from, specifier, kind, typeOnly, line }); return; }
      const to = relative(root, resolution.resolvedFileName);
      edges.push({ from, to, specifier, kind, typeOnly, internal: owned.has(to), line });
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) add(node, node.moduleSpecifier, ts.isImportDeclaration(node) ? 'static-import' : 'static-export', staticImportIsType(node));
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) add(node, node.moduleReference.expression, 'import-equals', staticImportIsType(node));
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        if (!dynamic) {
          const symbol = checker.getSymbolAtLocation(node.expression);
          if (symbol?.declarations?.some(declaration => !declaration.getSourceFile().isDeclarationFile)) {
            shadowedRequires.push({ from, expression: node.getText(source) });
            ts.forEachChild(node, visit); return;
          }
        }
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteralLike(arg) && (node.arguments.length === 1 || (dynamic && node.arguments.length === 2))) add(node, arg, dynamic ? 'dynamic-import' : 'require', false);
        else computed.push({ from, kind: dynamic ? 'computed-import' : 'computed-require', expression: node.getText(source), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const staticValues = edges.filter(edge => edge.internal && !edge.typeOnly && edge.kind !== 'dynamic-import');
  const dynamicValues = edges.filter(edge => edge.internal && !edge.typeOnly && edge.kind === 'dynamic-import');
  const cycles = stronglyConnected(files, staticValues);
  const isUI = file => /^(src\/(components|routes)\/)/.test(file);
  const forbidden = edges.filter(edge => edge.internal && !edge.typeOnly && ((edge.from.startsWith('src/domain/') && (edge.to.startsWith('src/db/') || isUI(edge.to))) || (edge.from.startsWith('src/db/') && isUI(edge.to))));
  const parseFailures = sources.flatMap(source => source.parseDiagnostics.map(diagnostic => ({ kind: 'source-parse', file: relative(root, source.fileName), message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') })));
  return {
    files, compilerInputs: program.getSourceFiles().filter(source => !relative(root, source.fileName).startsWith('node_modules/')).map(source => relative(root, source.fileName)).sort(),
    totalImportSites: edges.length + unresolved.length, totalEdges: edges.length, staticValueEdges: staticValues.length, dynamicValueEdges: dynamicValues.length, typeOnlyEdges: edges.filter(edge => edge.typeOnly).length,
    edges, cycles, forbidden, computed, unresolved, shadowedRequires,
    limits: ['Owned graph consists of non-declaration src TypeScript/TSX, including generated routes. Vendor/JSON/declarations participate in resolution but are not owned SCC nodes.', 'Literal dynamic imports are reported separately and enforce layer boundaries, but do not form eager static SCCs.', 'Computed imports/requires and shadowed require calls are reported; runtime reachability is not claimed.', 'Unresolved asset/virtual module resolution is reported; Knip full analysis separately enforces unresolved contracts.'],
    failures: [...parseFailures, ...cycles.map(members => ({ kind: 'static-value-cycle', members })), ...forbidden.map(edge => ({ ...edge, edgeKind: edge.kind, kind: 'forbidden-value-edge' }))],
  };
}
