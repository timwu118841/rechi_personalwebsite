const required = [
  'SITE_URL',
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'ADMIN_EMAILS',
];
const missing = required.filter((name) => !process.env[name]?.trim());

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

if (missing.length) {
  console.error(`正式部署環境設定不完整：\n- ${[...new Set(missing)].join('\n- ')}`);
  process.exit(1);
}

console.log(`正式部署設定驗證通過：${siteUrl.origin}`);
