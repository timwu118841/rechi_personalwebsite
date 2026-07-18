#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const migrationsDir = resolve(root, 'supabase/migrations');
const bundlePath = resolve(root, 'supabase/all-migrations.sql');
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const failures = [];
const bundle = readFileSync(bundlePath, 'utf8');
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
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
  const bundled = bundle
    .slice(start + marker.length, end)
    .replace(/\r\n/g, '\n')
    .replace(/^-- =+\n/gm, '')
    .trim();
  if (source !== bundled) failures.push(`bundle content differs: ${file}`);
}
const sections = [...bundle.matchAll(/^-- BEGIN (supabase\/migrations\/[^\n]+)$/gm)].map(
  (m) => m[1],
);
if (
  sections.length !== files.length ||
  sections.some((section, index) => section !== `supabase/migrations/${files[index]}`)
) {
  failures.push('bundle sections are not an ordered one-to-one match for migration files');
}
const requiredMarkers = [
  'publication_policy',
  'save_article_with_policy',
  'set_featured_article',
  'finalize_publication_candidate',
  'content_outbox',
  'actor_id',
];
for (const marker of requiredMarkers)
  if (!bundle.includes(marker)) failures.push(`bundle missing required contract: ${marker}`);

let psql = null;
try {
  psql = execFileSync('sh', ['-c', 'command -v psql'], { encoding: 'utf8' }).trim();
} catch {
  // psql is an optional local verification prerequisite.
}
if (psql && databaseUrl) {
  const catalogContractSql = String.raw`
with contract as (
  select 'columns' as kind, jsonb_agg(to_jsonb(c) order by c.table_schema, c.table_name, c.ordinal_position) as value
  from (
    select table_schema, table_name, ordinal_position, column_name, data_type, udt_schema,
      udt_name, is_nullable, column_default, identity_generation
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('articles', 'publication_candidates', 'content_audit_log', 'content_outbox')
  ) c
  union all
  select 'constraints', jsonb_agg(to_jsonb(c) order by c.schema_name, c.table_name, c.constraint_name)
  from (
    select n.nspname as schema_name, r.relname as table_name, con.conname as constraint_name,
      con.contype as constraint_type, pg_get_constraintdef(con.oid, true) as definition
    from pg_constraint con
    join pg_class r on r.oid = con.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname in ('public', 'storage')
  ) c
  union all
  select 'functions', jsonb_agg(to_jsonb(f) order by f.schema_name, f.function_name, f.identity_arguments)
  from (
    select n.nspname as schema_name, p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_get_function_result(p.oid) as result_type, l.lanname as language,
      p.prosecdef as security_definer, p.provolatile as volatility,
      coalesce(p.proconfig, '{}'::text[]) as configuration,
      pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
  ) f
  union all
  select 'function_grants', jsonb_agg(to_jsonb(g) order by g.schema_name, g.function_name, g.identity_arguments, g.grantee, g.privilege_type)
  from (
    select n.nspname as schema_name, p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_get_userbyid(a.grantee) as grantee, a.privilege_type::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
  ) g
  union all
  select 'relation_grants', jsonb_agg(to_jsonb(g) order by g.schema_name, g.relation_name, g.grantee, g.privilege_type)
  from (
    select n.nspname as schema_name, c.relname as relation_name,
      pg_get_userbyid(a.grantee) as grantee, a.privilege_type::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's'::"char" else 'r'::"char" end, c.relowner))) a
    where n.nspname in ('public', 'storage') and c.relkind in ('r', 'p', 'v', 'm', 'S')
  ) g
  union all
  select 'policies', jsonb_agg(to_jsonb(p) order by p.schemaname, p.tablename, p.policyname)
  from (
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'storage')
  ) p
  union all
  select 'contract_indexes', jsonb_agg(to_jsonb(i) order by i.schemaname, i.tablename, i.indexname)
  from (
    select schemaname, tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('articles', 'publication_candidates', 'content_audit_log', 'content_outbox')
  ) i
  union all
  select 'contract_triggers', jsonb_agg(to_jsonb(t) order by t.schema_name, t.table_name, t.trigger_name)
  from (
    select n.nspname as schema_name, c.relname as table_name, tg.tgname as trigger_name,
      pg_get_triggerdef(tg.oid, true) as definition
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not tg.tgisinternal and n.nspname = 'public'
      and c.relname in ('articles', 'publication_candidates', 'content_audit_log', 'content_outbox')
  ) t
)
select kind || E'\t' || coalesce(value, '[]'::jsonb)::text from contract order by kind;
`;

  const snapshotCatalog = (url) =>
    execFileSync(psql, [url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', catalogContractSql], {
      encoding: 'utf8',
    }).trim();

  {
    const suffix = `${process.pid}_${Date.now()}`;
    const names = [`migration_parity_ordered_${suffix}`, `migration_parity_bundle_${suffix}`];
    const urls = names.map((name) => {
      const url = new URL(databaseUrl);
      url.pathname = `/${name}`;
      return url.toString();
    });
    try {
      for (const name of names)
        execFileSync(
          psql,
          [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', `create database ${name}`],
          { stdio: 'inherit' },
        );
      const orderedSql = files
        .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
        .join('\n');
      execFileSync(psql, [urls[0], '-v', 'ON_ERROR_STOP=1'], {
        input: orderedSql,
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      execFileSync(psql, [urls[1], '-v', 'ON_ERROR_STOP=1'], {
        input: readFileSync(bundlePath),
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      const orderedCatalog = snapshotCatalog(urls[0]);
      const bundledCatalog = snapshotCatalog(urls[1]);
      if (orderedCatalog !== bundledCatalog) {
        failures.push(
          'ordered and bundled databases differ in final constraints, function definitions/signatures, grants, policies, or audit/outbox contracts',
        );
      }
      console.log(
        'PASS: ordered and bundled migrations applied; final database contracts were compared.',
      );
    } finally {
      for (const name of names) {
        try {
          execFileSync(
            psql,
            [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', `drop database if exists ${name}`],
            { stdio: 'inherit' },
          );
        } catch {
          // Best-effort cleanup must not mask the migration failure.
        }
      }
    }
  }
} else if (psql) {
  console.log(
    'STATIC-ONLY SKIP: PostgreSQL client found, but DATABASE_URL/SUPABASE_DB_URL is unset; database contract parity was not run.',
  );
} else {
  console.log(
    'STATIC-ONLY SKIP: PostgreSQL client unavailable; database contract parity was not run.',
  );
}
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`PASS: ${files.length} ordered migrations match supabase/all-migrations.sql`);
