import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const excludedEntries = new Set(['.DS_Store', '.git', '.github', '.gitignore', 'dist', 'docs', 'netlify', 'netlify.toml', 'node_modules', 'Oliver_Eckstein.zip', 'package-lock.json', 'package.json', 'playwright.config.ts', 'scripts', 'tests']);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const entries = await readdir(root);
await Promise.all(entries.filter(name => !excludedEntries.has(name)).map(async name => {
  if (name === 'admin') {
    const adminOutput = resolve(output, 'admin');
    await mkdir(adminOutput, { recursive: true });
    const adminEntries = await readdir(resolve(root, 'admin'));
    await Promise.all(adminEntries.filter(file => !file.endsWith('.php')).map(file =>
      cp(resolve(root, 'admin', file), resolve(adminOutput, file), { recursive: true })
    ));
    return;
  }
  await cp(resolve(root, name), resolve(output, name), { recursive: true });
}));
