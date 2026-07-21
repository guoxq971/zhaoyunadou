#!/usr/bin/env node
// 零依赖开发服务器：统一由 npm/Node 启动，并禁用缓存以便源码刷新立即生效。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8460;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
});

function validPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`[dev-server] port must be an integer between 1 and 65535: ${value}`);
  }
  return port;
}

export function parseServerOptions(args = [], env = process.env) {
  let host = env.HOST || DEFAULT_HOST;
  let port = env.PORT ? validPort(env.PORT) : DEFAULT_PORT;
  let positionalPort = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--port') {
      port = validPort(args[++index]);
    } else if (argument === '--host') {
      host = args[++index];
      if (!host) throw new TypeError('[dev-server] --host requires a value');
    } else if (!argument.startsWith('-') && !positionalPort) {
      port = validPort(argument);
      positionalPort = true;
    } else {
      throw new TypeError(`[dev-server] unknown argument: ${argument}`);
    }
  }
  return { host, port };
}

function send(response, statusCode, body = '') {
  const bytes = Buffer.from(body);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': bytes.length,
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(bytes);
}

function filePathFor(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  const candidate = resolve(root, `.${pathname}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

export function createDevServer({ root = PROJECT_ROOT } = {}) {
  const staticRoot = resolve(root);
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      send(response, 405, 'Method Not Allowed');
      return;
    }

    let filePath = filePathFor(staticRoot, request.url || '/');
    if (!filePath) {
      send(response, 400, 'Bad Request');
      return;
    }

    try {
      const metadata = await stat(filePath);
      if (metadata.isDirectory()) filePath = resolve(filePath, 'index.html');
      const file = await readFile(filePath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': file.length,
        'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : file);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') send(response, 404, 'Not Found');
      else {
        console.error('[dev-server] request failed', error);
        send(response, 500, 'Internal Server Error');
      }
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { host, port } = parseServerOptions(process.argv.slice(2));
  const server = createDevServer();
  server.listen(port, host, () => {
    console.log(`[dev-server] http://${host}:${port}/`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
