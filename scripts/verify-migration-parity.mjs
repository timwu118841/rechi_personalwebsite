#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const migrationsDir = resolve(root, 'supabase/migrations');
const bundlePath = resolve(root, 'supabase/all-migrations.sql');
const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
const failures = [];
const bundle = readFileSync(bundlePath, 'utf8');
for (const file of files) {
  const marker = `-- BEGIN supabase/migrations/${file}\n`;
  const endMarker = `\n-- END supabase/migrations/${file}`;
  const start = bundle.indexOf(marker);
  const end = start < 0 ? -1 : bundle.indexOf(endMarker, start + marker.length);
  if (start < 0 || end < 0) {
    failures.push(`missing bundle section: ${file}`);
    continue;
  }
  const source = readFileSync(resolve(migrationsDir, file), 'utf8').replace(/\r\n/g, '\n').trim();
  const bundled = bundle.slice(start + marker.length, end).replace(/\r\n/g, '\n').trim();
  if (source !== bundled) failures.push(`bundle content differs: ${file}`);
}
const sections = [...bundle.matchAll(/^-- BEGIN (supabase\/migrations\/[^\n]+)$/gm)].map((m) => m[1]);
if (sections.length !== files.length || sections.some((section, index) => section !== `supabase/migrations/${files[index]}`)) {
  failures.push('bundle sections are not an ordered one-to-one match for migration files');
}
const requiredMarkers = [
  'publication_policy',
  'save_article_with_policy',
  'finalize_publication_candidate',
  'content_outbox',
  'actor_id',
];
for (const marker of requiredMarkers) if (!bundle.includes(marker)) failures.push(`bundle missing required contract: ${marker}`);

let psql = null;
try { psql = execFileSync('sh', ['-c', 'command -v psql'], { encoding: 'utf8' }).trim(); } catch {}
if (psql) {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (databaseUrl) {
    console.log(`PostgreSQL client found at ${psql}; fresh-database execution requires an explicit disposable DATABASE_URL and is not run against an existing target.`);
  } else {
    console.log('PostgreSQL client found, but DATABASE_URL/SUPABASE_DB_URL is unset; static parity checks completed.');
  }
} else {
  console.log('PostgreSQL client unavailable; static migration parity checks completed. Install psql for fresh-database smoke verification.');
}
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`PASS: ${files.length} ordered migrations match supabase/all-migrations.sql`);
