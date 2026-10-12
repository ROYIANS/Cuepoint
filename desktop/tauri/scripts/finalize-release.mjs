import {resolve} from 'node:path';
import {parseOptions} from './release-policy.mjs';
import {copyCheckReports} from './release-artifacts.mjs';
const options=parseOptions(process.argv.slice(2),['--receipt','--checks'],['--checks']);
if (!options['--receipt'] || !options['--checks']?.length) throw new Error('Require --receipt and one or more --checks reports');
await copyCheckReports(resolve(options['--receipt']),options['--checks'].map(path=>resolve(path)));
