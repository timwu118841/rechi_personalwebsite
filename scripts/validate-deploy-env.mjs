const required = [
  'SITE_URL',
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'CRON_SECRET',
  'NOTION_EDITORIAL_ENABLED',
];
const missing = required.filter((name) => !process.env[name]?.trim());

if (
  process.env.NOTION_EDITORIAL_ENABLED &&
  !['true', 'false'].includes(process.env.NOTION_EDITORIAL_ENABLED)
) {
  missing.push('NOTION_EDITORIAL_ENABLED（只能是 true 或 false）');
}

if (process.env.NOTION_EDITORIAL_ENABLED === 'true') {
  for (const name of ['NOTION_TOKEN', 'NOTION_DATA_SOURCE_ID', 'NOTION_VERSION']) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
}

if (process.env.NOTION_VERSION && process.env.NOTION_VERSION !== '2026-03-11') {
  missing.push('NOTION_VERSION（必須固定為 2026-03-11）');
}

if (process.env.NOTION_DATA_SOURCE_ID) {
  const compactPageId = process.env.NOTION_DATA_SOURCE_ID.replaceAll('-', '');
  if (!/^[0-9a-f]{32}$/i.test(compactPageId)) {
    missing.push('NOTION_DATA_SOURCE_ID（必須是 32 個十六進位字元的 data source UUID）');
  }
}

const allowedModes = {
  CONTENT_PUBLIC_READ_MODE: ['service', 'publishable'],
  NOTION_PUBLICATION_MODE: ['legacy', 'shadow', 'notion'],
};
for (const [name, values] of Object.entries(allowedModes)) {
  if (process.env[name] && !values.includes(process.env[name])) {
    missing.push(`${name}（只能是 ${values.join('、')}）`);
  }
}

let siteUrl;
try {
  siteUrl = new URL(process.env.SITE_URL || '');
} catch {
  missing.push('SITE_URL（必須是完整 https URL）');
}

if (siteUrl && siteUrl.protocol !== 'https:') {
  missing.push('SITE_URL（正式站必須使用 https）');
}

for (const name of ['PUBLIC_SUPABASE_URL']) {
  try {
    const value = new URL(process.env[name] || '');
    if (value.protocol !== 'https:') missing.push(`${name}（必須使用 https）`);
  } catch {
    missing.push(`${name}（必須是完整 URL）`);
  }
}

if (process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_SECRET_KEY.length < 24) {
  missing.push('SUPABASE_SECRET_KEY（格式不正確）');
}

if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 16) {
  missing.push('CRON_SECRET（至少需要 16 個字元）');
}

if (missing.length) {
  console.error(`正式部署環境設定不完整：\n- ${[...new Set(missing)].join('\n- ')}`);
  process.exit(1);
}

console.log(`正式部署設定驗證通過：${siteUrl.origin}`);
