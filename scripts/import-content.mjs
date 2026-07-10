import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'yaml';

const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error('請先設定 PUBLIC_SUPABASE_URL 與 SUPABASE_SECRET_KEY。');
  process.exit(1);
}
const client = createClient(url, secretKey, { auth: { persistSession: false } });

async function yamlEntries(directory) {
  const files = (await readdir(directory)).filter((name) => /\.ya?ml$/i.test(name));
  return Promise.all(
    files.map(async (name) => ({
      slug: name.replace(/\.ya?ml$/i, ''),
      ...parse(await readFile(join(directory, name), 'utf8')),
    })),
  );
}

function frontmatter(source, path) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${path} 缺少有效 frontmatter。`);
  return { data: parse(match[1]), body: match[2].trim() };
}

const categories = await yamlEntries('src/content/categories');
const contentTypes = await yamlEntries('src/content/content-types');
const articleFiles = [];
for (const directory of await readdir('src/content/articles', { withFileTypes: true })) {
  if (directory.isDirectory())
    articleFiles.push(join('src/content/articles', directory.name, 'index.mdoc'));
}
const articles = await Promise.all(
  articleFiles.map(async (path) => {
    const { data, body } = frontmatter(await readFile(path, 'utf8'), path);
    return {
      slug: basename(dirname(path)),
      title: data.title,
      description: data.description,
      body_markdown: body,
      status: data.status,
      published_at: new Date(data.publishedAt).toISOString(),
      content_type_slug: data.contentType,
      category_slug: data.category,
      tags: data.tags || [],
      featured: Boolean(data.featured),
      seo_title: data.seoTitle || null,
      seo_description: data.seoDescription || null,
      canonical_url: data.canonicalUrl || null,
      privacy_reviewed: Boolean(data.privacyReviewed),
      legal_reviewed: Boolean(data.legalReviewed),
    };
  }),
);

for (const [table, values] of [
  ['content_types', contentTypes],
  ['categories', categories.map(({ order, ...item }) => ({ ...item, display_order: order }))],
  ['articles', articles],
]) {
  const { error } = await client.from(table).upsert(values, { onConflict: 'slug' });
  if (error) throw error;
  console.log(`${table}: 已匯入 ${values.length} 筆`);
}

console.log('既有 Git 內容匯入完成；重新執行會依 slug 更新，不會建立重複文章。');
