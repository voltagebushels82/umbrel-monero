import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
async function check(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(file);
    else if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
for (const directory of ['bin', 'logic', 'middlewares', 'models', 'routes', 'services', 'utils', 'scripts', 'test']) await check(directory);
const result = spawnSync(process.execPath, ['--check', 'app.js'], {stdio: 'inherit'});
process.exitCode = result.status || 0;
