import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const failures = [];
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const output = resolve('.vercel/output');
const client = resolve('dist/client');
for (const path of [
  join(output, 'config.json'),
  join(output, 'functions/_render.func/.vc-config.json'),
  join(output, '_functions/entry.mjs'),
  join(output, 'static/favicon.svg'),
  join(output, 'static/social-card.svg'),
]) {
  if (!(await exists(path))) failures.push(`缺少 Vercel server output：${path}`);
}

if (await exists(join(output, 'config.json'))) {
  const config = JSON.parse(await readFile(join(output, 'config.json'), 'utf8'));
  const sources = (config.routes || [])
    .map((route) => route.src)
    .filter(Boolean)
    .join('\n');
  for (const route of [
    '/admin',
    '/api/admin/articles',
    '/articles',
    '/rss\\.xml',
    '/sitemap\\.xml',
  ]) {
    if (!sources.includes(route)) failures.push(`Vercel server output 缺少動態路由：${route}`);
  }
  if (sources.includes('keystatic')) failures.push('Vercel 路由仍包含已移除的 Keystatic');
}

const functionFiles = await readdir(join(output, '_functions/chunks')).catch(() => []);
const cacheProvider = functionFiles.find((name) =>
  name.startsWith('_virtual_astro_cache-provider_'),
);
if (!cacheProvider) {
  failures.push('Vercel server output 缺少 Astro CDN cache provider');
} else {
  const source = await readFile(join(output, '_functions/chunks', cacheProvider), 'utf8');
  if (!source.includes('Vercel-Cache-Tag') || !source.includes('Vercel-CDN-Cache-Control')) {
    failures.push('Vercel cache provider 未輸出 cache tag／control 支援');
  }
}

const publicAssets = await readdir(join(client, '_astro')).catch(() => []);
if (!publicAssets.some((name) => name.startsWith('AdminApp.')))
  failures.push('管理後台 client bundle 缺失');
if (!publicAssets.some((name) => name.startsWith('global.') && name.endsWith('.css')))
  failures.push('公開網站樣式 bundle 缺失');

if (failures.length) {
  console.error(`建置驗證失敗：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('建置驗證通過：動態路由、管理後台、Vercel Function 與 CDN cache provider 皆存在。');
