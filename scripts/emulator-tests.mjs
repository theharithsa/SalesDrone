import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,['--test','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=./scripts/ci-test-reporter.mjs','--test-reporter-destination=test-results/cases-emulator.ndjson','functions/test/emulator.integration.js'],{cwd:root,stdio:'inherit',env:{...process.env,CI_CASE_ROOT:root,CI_CASE_SUITE:'emulator'}});
child.once('error',()=>{process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
