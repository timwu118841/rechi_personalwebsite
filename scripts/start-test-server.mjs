import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import app from '../.vercel/output/functions/_render.func/dist/server/entry.mjs';

const port = Number(process.env.PLAYWRIGHT_PORT || 4321);
const host = '127.0.0.1';
const staticRoot = resolve('.vercel/output/static');
const mimeTypes = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

function staticFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = resolve(staticRoot, `.${decoded}`);
  if (!file.startsWith(`${staticRoot}${sep}`) || !existsSync(file) || !statSync(file).isFile()) {
    return null;
  }
  return file;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url || '/', `http://${host}:${port}`);
    if (url.pathname === '/__playwright_health') {
      outgoing.statusCode = 200;
      outgoing.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return outgoing.end('ok');
    }
    const file = staticFile(url.pathname);
    if (file && (incoming.method === 'GET' || incoming.method === 'HEAD')) {
      const stats = statSync(file);
      outgoing.statusCode = 200;
      outgoing.setHeader(
        'Content-Type',
        mimeTypes.get(extname(file)) || 'application/octet-stream',
      );
      outgoing.setHeader('Content-Length', stats.size);
      outgoing.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (incoming.method === 'HEAD') return outgoing.end();
      return createReadStream(file).pipe(outgoing);
    }

    const init = {
      method: incoming.method,
      headers: incoming.headers,
    };
    if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
      init.body = Readable.toWeb(incoming);
      init.duplex = 'half';
    }
    const response = await app.fetch(new Request(url, init));
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    if (!response.body || incoming.method === 'HEAD') return outgoing.end();
    Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) outgoing.statusCode = 500;
    outgoing.end('Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Production test server ready at http://${host}:${port}`);
});

const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
