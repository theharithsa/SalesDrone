import { spawn } from 'node:child_process';
const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  [
    'run',
    'dev',
    '-w',
    'apps/web',
    '--',
    '--host',
    '127.0.0.1',
    '--port',
    '5180',
    '--strictPort',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_USE_EMULATORS: 'true',
      VITE_ENABLE_RUM: 'false',
    },
  },
);
child.on('error', (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
