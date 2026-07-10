import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const mediaRoot = new URL('../src/assets/images/articles/', import.meta.url);
const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const maxBytes = 3 * 1024 * 1024;
const issues = [];

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(directory.pathname, entry.name);
    if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, directory));
    if (!entry.isFile()) continue;
    const extension = extname(entry.name).toLowerCase();
    const info = await stat(path);
    if (!allowed.has(extension)) issues.push(`${relative(process.cwd(), path)}: 不支援的圖片格式`);
    if (info.size > maxBytes) issues.push(`${relative(process.cwd(), path)}: 超過 3 MB 上限`);
  }
}

await walk(mediaRoot);
if (issues.length) {
  console.error(`內容媒體驗證失敗：\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log('內容媒體驗證通過');
