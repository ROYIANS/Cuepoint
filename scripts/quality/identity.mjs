import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { hash, IDENTITY_VERSION } from './shared.mjs';

// Traverse the parsed token tree. A context-free scanner misreads regex and
// template substitutions; the parser's leaf tokens preserve those semantics.
export function semanticTokens(node, source) {
  const tokens = [];
  function visit(current) {
    const children = current.getChildren(source);
    if (children.length) children.forEach(visit);
    else if (current.kind !== ts.SyntaxKind.EndOfFileToken && current.getWidth(source) > 0) tokens.push([ts.SyntaxKind[current.kind], (ts.isStringLiteral(current) || ts.isIdentifier(current) ? current.text : current.getText(source))]);
  }
  visit(node);
  return tokens;
}
function transparent(node) {
  return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node);
}
function unwrap(node) {while (transparent(node)) node = node.expression; return node;}
function containingArgument(node) {
  let argument = node;
  while (argument.parent && transparent(argument.parent)) argument = argument.parent;
  return argument;
}
function ownerName(node, source) {
  const nameKey = name => ts.isIdentifier(name) ? name.text : JSON.stringify(semanticTokens(name, source));
  if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) && node.name) return `${ts.SyntaxKind[node.kind]}:${nameKey(node.name)}`;
  if ((ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isTypeParameterDeclaration(node)) && node.name) return `${ts.SyntaxKind[node.kind]}:${nameKey(node.name)}`;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const argument = containingArgument(node), parent = argument.parent;
    if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) return ts.isFunctionExpression(node) && node.name ? `FunctionExpression:${nameKey(node.name)}` : null;
    if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
      const args = [...(parent.arguments ?? [])];
      const role = args.indexOf(argument);
      const context = args.map((value, index) => {
        const actual = unwrap(value);
        return ts.isArrowFunction(actual) || ts.isFunctionExpression(actual)
          ? ['CallbackArgument', index, ts.SyntaxKind[actual.kind], Boolean(actual.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)), Boolean(actual.asteriskToken), actual.name ? nameKey(actual.name) : null] : semanticTokens(value, source);
      });
      return `Callback:${JSON.stringify([ts.SyntaxKind[parent.kind], Boolean(parent.questionDotToken), semanticTokens(parent.expression, source), role, context])}`;
    }
    return ts.isFunctionExpression(node) && node.name ? `FunctionExpression:${nameKey(node.name)}` : 'UnsupportedAnonymousOwner';
  }
  return null;
}
function controlOwner(node, child, source) {
  const tokens = value => value ? semanticTokens(value, source) : [];
  if (ts.isIfStatement(node)) return `If:${child === node.thenStatement ? 'then' : child === node.elseStatement ? 'else' : 'condition'}:${JSON.stringify(tokens(node.expression))}`;
  if (ts.isConditionalExpression(node)) return `Conditional:${child === node.whenTrue ? 'true' : child === node.whenFalse ? 'false' : 'condition'}:${JSON.stringify(tokens(node.condition))}`;
  if (ts.isSwitchStatement(node)) return `Switch:${JSON.stringify(tokens(node.expression))}`;
  if (ts.isCaseClause(node)) return `Case:${JSON.stringify(tokens(node.expression))}`;
  if (ts.isDefaultClause(node)) return 'DefaultCase';
  if (ts.isWhileStatement(node) || ts.isDoStatement(node)) return `${ts.SyntaxKind[node.kind]}:${JSON.stringify(tokens(node.expression))}`;
  if (ts.isForStatement(node)) return `For:${JSON.stringify([tokens(node.initializer), tokens(node.condition), tokens(node.incrementor)])}`;
  if (ts.isForInStatement(node) || ts.isForOfStatement(node)) return `${ts.SyntaxKind[node.kind]}:${JSON.stringify([tokens(node.initializer), tokens(node.expression)])}`;
  if (ts.isCatchClause(node)) return `Catch:${JSON.stringify(tokens(node.variableDeclaration))}`;
  if (ts.isLabeledStatement(node)) return `Label:${node.label.text}`;
  if (ts.isTryStatement(node)) return `Try:${child === node.tryBlock ? 'body' : child === node.finallyBlock ? 'finally' : 'catch'}`;
  return null;
}
function ownerPath(node, source) {
  const names = [];
  for (let current = node, child; current && current !== source; child = current, current = current.parent) {
    const name = ownerName(current, source) ?? controlOwner(current, child, source);
    if (name) names.unshift(name);
  }
  return names;
}
export function describeDiagnostic(file, text, message) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) return { signature: null, identityError: 'TypeScript could not parse this diagnostic source' };
  if (!message.ruleId || !message.line || !message.column || !message.endLine || !message.endColumn) return { signature: null, identityError: 'Diagnostic has no exact rule/range; cannot authorize debt' };
  const start = source.getPositionOfLineAndCharacter(message.line - 1, message.column - 1);
  const end = source.getPositionOfLineAndCharacter(message.endLine - 1, message.endColumn - 1);
  let target = source;
  function descend(node) {
    if (node.getStart(source) <= start && node.end >= end) {
      target = node;
      node.forEachChild(descend);
    }
  }
  descend(source);
  // Identifier/member reports must anchor the expression, including its operand.
  // Climb only expression wrappers, retaining repeated-node multiplicity.
  while (target.parent && (ts.isPropertyAccessExpression(target.parent) || ts.isElementAccessExpression(target.parent) || ts.isCallExpression(target.parent) || ts.isNewExpression(target.parent) || ts.isAsExpression(target.parent) || ts.isNonNullExpression(target.parent) || ts.isParenthesizedExpression(target.parent))) target = target.parent;
  if (target === source) return { signature: null, identityError: 'No bounded semantic node for this diagnostic' };
  const owners = ownerPath(target, source);
  if (owners.includes('UnsupportedAnonymousOwner')) return {signature: null, identityError: 'Unsupported anonymous owner needs a named semantic boundary before authorizing debt'};
  const callbackOwners = [];
  for (let current = target; current && current !== source; current = current.parent) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const key = ownerName(current, source);
      if (key?.startsWith('Callback:')) callbackOwners.push({node: current, key: JSON.stringify(ownerPath(current, source))});
    }
  }
  for (const {node, key} of callbackOwners) {
    let scope = node.parent;
    while (scope.parent && scope !== source && !ts.isFunctionLike(scope)) scope = scope.parent;
    let matches = 0;
    function count(current) {
      if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && JSON.stringify(ownerPath(current, source)) === key) matches++;
      current.forEachChild(count);
    }
    count(scope);
    if (matches > 1) return {signature: null, identityError: 'Indistinguishable sibling callback owners require a named semantic boundary before authorizing debt'};
  }
  // Equal repeated guard headers are not unique semantic locations. A named
  // boundary is required instead of an unstable line/ordinal authorization.
  for (let current = target; current && current !== source; current = current.parent) {
    if (!controlOwner(current, undefined, source)) continue;
    let scope = current.parent;
    while (scope?.parent && scope !== source && !ts.isFunctionLike(scope)) scope = scope.parent;
    const key = JSON.stringify(ownerPath(current, source));
    let matches = 0;
    function count(node) {
      if (controlOwner(node, undefined, source) && JSON.stringify(ownerPath(node, source)) === key) matches++;
      node.forEachChild(count);
    }
    count(scope ?? source);
    if (matches > 1) return {signature: null, identityError: 'Indistinguishable control-flow owners require a named semantic boundary before authorizing debt'};
  }
  const nodeTokens = semanticTokens(target, source);
  const semanticOwner = owners.length ? owners.join('/') : '<module>';
  const nodeKind = ts.SyntaxKind[target.kind];
  return { identityVersion: IDENTITY_VERSION, semanticOwner, nodeKind, nodeTokens, signature: hash(JSON.stringify([IDENTITY_VERSION, semanticOwner, nodeKind, nodeTokens])) };
}

export async function identityProducer() {
  return { sha256: hash(await readFile(new URL('./identity.mjs', import.meta.url))), typescript: ts.version };
}
