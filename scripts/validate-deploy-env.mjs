const required = ['SITE_URL', 'PUBLIC_KEYSTATIC_CLOUD_PROJECT', 'KEYSTATIC_SECRET'];
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

if (process.env.KEYSTATIC_SECRET && process.env.KEYSTATIC_SECRET.length < 32) {
  missing.push('KEYSTATIC_SECRET（至少 32 個字元）');
}

if (missing.length) {
  console.error(`正式部署環境設定不完整：\n- ${[...new Set(missing)].join('\n- ')}`);
  process.exit(1);
}

console.log(`正式部署設定驗證通過：${siteUrl.origin}`);
