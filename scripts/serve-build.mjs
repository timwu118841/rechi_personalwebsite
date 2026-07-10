import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';

const root = resolve('dist/client');
const port = Number(process.argv[2] || 4321);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml; charset=utf-8',
};

async function resolveFile(pathname) {
  const candidate = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (!candidate.startsWith(`${root}/`) && candidate !== root) return null;

  try {
    const metadata = await stat(candidate);
    return metadata.isDirectory() ? resolve(candidate, 'index.html') : candidate;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
  const file = await resolveFile(pathname);
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
