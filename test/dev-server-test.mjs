import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDevServer,
  parseServerOptions,
} from '../scripts/dev-server.mjs';

assert.deepEqual(parseServerOptions([], {}), { host: '127.0.0.1', port: 8460 });
assert.deepEqual(parseServerOptions(['8464'], {}), { host: '127.0.0.1', port: 8464 });
assert.deepEqual(parseServerOptions(['--port', '9001', '--host', '0.0.0.0'], {}), {
  host: '0.0.0.0',
  port: 9001,
});
assert.deepEqual(parseServerOptions([], { HOST: '0.0.0.0', PORT: '9100' }), {
  host: '0.0.0.0',
  port: 9100,
});
assert.throws(() => parseServerOptions(['--port', '0'], {}), /port/i);
assert.throws(() => parseServerOptions(['--unknown'], {}), /unknown argument/i);

const root = await mkdtemp(join(tmpdir(), 'zyad-dev-server-'));
await writeFile(join(root, 'index.html'), '<!doctype html><title>赵云与阿斗</title>');
await writeFile(join(root, 'module.js'), 'export const ready = true;');

const server = createDevServer({ root });
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const index = await fetch(`${baseUrl}/`);
  assert.equal(index.status, 200);
  assert.equal(index.headers.get('cache-control'), 'no-store');
  assert.match(index.headers.get('content-type'), /^text\/html/);
  assert.match(await index.text(), /赵云与阿斗/);

  const moduleHead = await fetch(`${baseUrl}/module.js`, { method: 'HEAD' });
  assert.equal(moduleHead.status, 200);
  assert.equal(moduleHead.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(await moduleHead.text(), '');

  assert.equal((await fetch(`${baseUrl}/missing.js`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/`, { method: 'POST' })).status, 405);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}

console.log('✓ npm Node 开发服务器参数、静态文件、no-store 与错误响应');
