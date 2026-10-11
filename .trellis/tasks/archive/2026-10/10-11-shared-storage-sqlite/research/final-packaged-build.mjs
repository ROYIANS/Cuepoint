import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';

const root = process.cwd(), research = resolve(root, '.trellis/tasks/10-11-shared-storage-sqlite/research');
const baselinePath = join(research, 'code-gates-02/acceptance.json');
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function currentInputs() {
  return Object.fromEntries(await Promise.all(Object.keys(baseline.sourceAfter).map(async file => [file, hash(await readFile(join(root, file)))])));
}
const before = await currentInputs();
const baselineChanged = Object.keys(before).filter(file => before[file] !== baseline.sourceAfter[file]);
if (baselineChanged.length) throw new Error(`Build inputs changed from the recorded all-scope freeze: ${baselineChanged.join(', ')}`);
const command = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node';
const args = [join(root, 'desktop/tauri/scripts/build-app.mjs'), '--isolated-product', '--sqlite-product'];
const identifier = 'dev.cuepoint.review.sqlite20261012final';
const logPath = join(research, 'final-packaged-build.log'), log = createWriteStream(logPath, {flags: 'wx'});
const report = {schemaVersion: 1, startedAt: new Date().toISOString(), command, args, environment: {CARGO_INCREMENTAL: '0', CUEPOINT_PRODUCT_IDENTIFIER: identifier}, sourceReceipt: 'code-gates-02/acceptance.json', sourceReceiptSha256: hash(await readFile(baselinePath)), sourceBefore: before, baselineChanged, normalOwnerActivated: false, completionClaim: false};
report.exitCode = await new Promise((accept, reject) => {
  const child = spawn(command, args, {cwd: root, env: {...process.env, ...report.environment}, stdio: ['ignore', 'pipe', 'pipe']});
  child.stdout.pipe(log, {end: false}); child.stderr.pipe(log, {end: false});
  child.on('error', reject); child.on('exit', (code, signal) => {report.signal = signal; accept(signal ? 1 : code ?? 1);});
});
await new Promise(done => log.end(done));
report.sourceAfter = await currentInputs();
report.changedInputs = Object.keys(before).filter(file => before[file] !== report.sourceAfter[file]);
report.logSha256 = hash(await readFile(logPath));
if (report.exitCode === 0) {
  const bundleReceipt = join(root, 'desktop/tauri/.acceptance/isolated-sqlite-product-bundle.json');
  report.bundle = JSON.parse(await readFile(bundleReceipt, 'utf8'));
  await copyFile(bundleReceipt, join(research, 'final-isolated-bundle.json'));
  if (report.bundle.identifier !== identifier || report.bundle.storage !== 'sqlite') throw new Error('Wrong isolated bundle identity/owner');
  const plist = join(report.bundle.app, 'Contents/Info.plist');
  await copyFile(plist, join(research, 'final-bundle-Info.plist'));
  const data = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plist], {encoding: 'utf8'}));
  report.actualBundle = {identifier: data.CFBundleIdentifier, executable: data.CFBundleExecutable, plistSha256: hash(await readFile(plist)), transportSecurity: data.NSAppTransportSecurity, microphonePurpose: data.NSMicrophoneUsageDescription, executableSha256: hash(await readFile(join(report.bundle.app, 'Contents/MacOS', data.CFBundleExecutable)))};
  const expected = {NSExceptionDomains: {'127.0.0.1': {NSExceptionAllowsInsecureHTTPLoads: true}}};
  report.mergedPolicyPass = JSON.stringify(report.actualBundle.transportSecurity) === JSON.stringify(expected) && data.CFBundleIdentifier === identifier && typeof data.NSMicrophoneUsageDescription === 'string';
}
report.finishedAt = new Date().toISOString();
report.buildPass = report.exitCode === 0 && report.changedInputs.length === 0 && report.mergedPolicyPass;
report.pending = ['Actual full product SQLite UI / Agent / managed bytes / WebKit playback / relaunch on unlocked macOS', 'Normal SQLite activation after complete isolated acceptance'];
await writeFile(join(research, 'final-packaged-build.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({buildPass: report.buildPass, exitCode: report.exitCode, changedInputs: report.changedInputs, mergedPolicyPass: report.mergedPolicyPass, bundle: report.bundle, pending: report.pending}, null, 2));
process.exitCode = report.buildPass ? 0 : 1;
