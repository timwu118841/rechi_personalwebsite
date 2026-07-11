-- Rich article storage is additive: existing Markdown rows remain readable.
alter table public.articles add column if not exists body_json jsonb;
alter table public.articles add column if not exists body_html text;

-- New rich articles do not need a duplicated Markdown representation. Existing
-- rows are untouched and continue to satisfy the legacy branch of this check.
alter table public.articles alter column body_markdown drop not null;
alter table public.articles drop constraint if exists articles_body_markdown_check;
alter table public.articles add constraint articles_body_content_check
  check ((body_markdown is not null and char_length(body_markdown) > 0) or body_json is not null);

