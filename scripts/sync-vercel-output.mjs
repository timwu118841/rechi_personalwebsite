import { access, cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const clientRoot = resolve('dist/client');
const vercelStaticRoot = resolve('.vercel/output/static');
const vercelConfig = resolve('.vercel/output/config.json');

await Promise.all([access(clientRoot), access(vercelStaticRoot), access(vercelConfig)]);
await cp(clientRoot, vercelStaticRoot, { recursive: true, force: true });

console.log('已同步建置後產生的靜態資源至 Vercel 輸出');
