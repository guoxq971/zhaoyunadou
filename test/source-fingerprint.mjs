import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function collectFiles(root, target, output) {
  const path = join(root, target);
  const entries = await readdir(path, { withFileTypes: true }).catch(() => null);
  if (!entries) { output.push(path); return; }
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await collectFiles(root, relative(root, child), output);
    else if (entry.isFile()) output.push(child);
  }
}

export async function sourceFingerprint(root) {
  const files = [];
  for (const target of ['index.html', 'package.json', 'assets', 'src', 'test']) {
    await collectFiles(root, target, files);
  }
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(relative(root, file));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}
