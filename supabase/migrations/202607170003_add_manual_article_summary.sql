-- Keep editorial summaries independent from Notion content.
alter table public.article_working_copies
  add column manual_summary text
  check (
    manual_summary is null
    or char_length(btrim(manual_summary)) between 20 and 180
  );

comment on column public.article_working_copies.manual_summary is
  'Admin-authored article summary. Notion synchronization must not populate or overwrite this field.';
