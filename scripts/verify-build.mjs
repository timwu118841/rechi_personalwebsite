import { gzipSync } from 'node:zlib';
import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve('dist/client');
const failures = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const required = [
  'index.html',
  'articles/index.html',
  'articles/welcome/index.html',
  'rss.xml',
  'robots.txt',
  'sitemap-index.xml',
  'pagefind/pagefind.js',
];
for (const path of required) {
  if (!(await exists(join(root, path)))) failures.push(`缺少建置產物：${path}`);
}

const articlePath = join(root, 'articles/welcome/index.html');
const article = await readFile(articlePath, 'utf8');
for (const pattern of [
  /<title>.+<\/title>/,
  /<link rel="canonical" href="https?:\/\//,
  /application\/ld\+json/,
  /og:title/,
  /法律資訊與經驗分享/,
]) {
  if (!pattern.test(article)) failures.push(`文章頁缺少必要 SEO／內容契約：${pattern}`);
}

const jsonLdBlocks = [
  ...article.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
];
if (!jsonLdBlocks.length) failures.push('文章頁沒有 JSON-LD');
for (const [, value] of jsonLdBlocks) {
  try {
    const data = JSON.parse(value);
    const blocks = Array.isArray(data) ? data : [data];
    if (!blocks.some((block) => block['@type'] === 'BlogPosting')) {
      failures.push('文章頁 JSON-LD 缺少 BlogPosting');
    }
    if (!blocks.some((block) => block['@type'] === 'BreadcrumbList')) {
      failures.push('文章頁 JSON-LD 缺少 BreadcrumbList');
    }
  } catch {
    failures.push('文章頁 JSON-LD 不是有效 JSON');
  }
}

const search = await readFile(join(root, 'search/index.html'), 'utf8');
if (!/noindex, nofollow/.test(search)) failures.push('搜尋頁缺少 noindex');
const notFound = await readFile(join(root, '404.html'), 'utf8');
if (!/noindex, nofollow/.test(notFound)) failures.push('404 頁缺少 noindex');

const publicFiles = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(?:html|xml|txt|pf_index|pf_meta)$/.test(entry.name)) publicFiles.push(path);
  }
}
await collect(root);
for (const path of publicFiles) {
  const content = await readFile(path, 'utf8').catch(() => '');
  if (content.includes('尚未公開的草稿') || content.includes('private-draft')) {
    failures.push(`草稿洩漏至公開產物：${path.replace(`${root}/`, '')}`);
  }
}

const htmlFiles = publicFiles.filter((path) => extname(path) === '.html');
const canonicalOwners = new Map();
for (const path of htmlFiles) {
  const outputPath = relative(root, path);
  const content = await readFile(path, 'utf8');
  const isNoindex = /<meta name="robots" content="noindex, nofollow"/.test(content);
  const title = content.match(/<title>([^<]+)<\/title>/)?.[1]?.trim();
  const description = content.match(/<meta name="description" content="([^"]+)"/)?.[1]?.trim();
  const canonical = content.match(/<link rel="canonical" href="([^"]+)"/)?.[1];

  if (!title) failures.push(`${outputPath} 缺少非空 title`);
  if (!description) failures.push(`${outputPath} 缺少非空 description`);
  if (!canonical) failures.push(`${outputPath} 缺少 canonical`);

  if (canonical && !isNoindex) {
    try {
      const url = new URL(canonical);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      const owner = canonicalOwners.get(canonical);
      if (owner) failures.push(`重複 canonical：${canonical}（${owner}、${outputPath}）`);
      canonicalOwners.set(canonical, outputPath);
    } catch {
      failures.push(`${outputPath} canonical 不是有效絕對 URL：${canonical}`);
    }
  }

  for (const [, href] of content.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(href) || href.includes('${')) continue;
    const url = new URL(href, 'https://build.local');
    if (url.pathname.startsWith('/keystatic')) continue;
    const decodedPath = decodeURIComponent(url.pathname);
    const candidate = decodedPath.endsWith('/')
      ? join(root, decodedPath.slice(1), 'index.html')
      : join(root, decodedPath.slice(1));
    if (!(await exists(candidate))) failures.push(`${outputPath} 含失效內部連結：${href}`);
  }
}

const rss = await readFile(join(root, 'rss.xml'), 'utf8');
const sitemap = await readFile(join(root, 'sitemap-0.xml'), 'utf8');
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
for (const [name, content] of [
  ['RSS', rss],
  ['sitemap', sitemap],
]) {
  if (!/https?:\/\//.test(content)) failures.push(`${name} 缺少絕對 URL`);
  if (/private-draft|\/search\/|\/keystatic|\/404/.test(content)) {
    failures.push(`${name} 洩漏非公開或 noindex 路由`);
  }
}
if (!/Sitemap:\s*https?:\/\//i.test(robots)) failures.push('robots.txt 缺少絕對 sitemap URL');

if (!article.includes("new Set(['article_read', 'external_link', 'site_search'])")) {
  failures.push('分析事件 allowlist 缺失或遭變更');
}
if (/blogAnalytics\.track\([^)]*\b(?:query|email|caseId)\b/.test(article)) {
  failures.push('文章分析程式可能傳送未核准的敏感欄位');
}

let scriptBytes = 0;
for (const match of article.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  scriptBytes += gzipSync(match[1]).byteLength;
}
for (const match of article.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)) {
  const src = match[1];
  if (!src.startsWith('/')) continue;
  const path = join(root, src.split('?')[0]);
  if (await exists(path)) scriptBytes += gzipSync(await readFile(path)).byteLength;
}
if (scriptBytes > 75 * 1024) {
  failures.push(`文章頁 JavaScript ${scriptBytes} bytes gzip，超過 75 KB 預算`);
}

if (failures.length) {
  console.error(`建置驗證失敗：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`建置驗證通過；代表文章頁 JavaScript 約 ${scriptBytes} bytes gzip`);
