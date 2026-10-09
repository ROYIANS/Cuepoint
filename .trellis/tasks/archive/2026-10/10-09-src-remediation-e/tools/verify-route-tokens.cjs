const fs = require("node:fs");
const ts = require(require("node:path").join(process.cwd(), "node_modules/typescript"));
function tokens(file) {
 const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, fs.readFileSync(file, "utf8"));
 const result = [];
 for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
 return result;
}
const before = tokens(process.argv[2]), after = tokens(process.argv[3]);
const same = JSON.stringify(before) === JSON.stringify(after);
console.log(JSON.stringify({same, beforeTokens: before.length, afterTokens: after.length}));
process.exit(same ? 0 : 1);
