create or replace function public.enqueue_content_job(
  p_job_type text,
  p_dedupe_key text default null,
  p_source_id uuid default null,
  p_candidate_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_run_after timestamptz default now(),
  p_priority integer default 100,
  p_max_attempts integer default 5
)
returns public.content_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.content_jobs%rowtype;
  v_dedupe_key text := nullif(btrim(coalesce(p_dedupe_key, '')), '');
  v_attempt integer;
begin
  for v_attempt in 1..3 loop
    v_job := null;
    insert into public.content_jobs (
      job_type,
      dedupe_key,
      source_id,
      candidate_id,
      payload,
      run_after,
      priority,
      max_attempts
    ) values (
      btrim(p_job_type),
      v_dedupe_key,
      p_source_id,
      p_candidate_id,
      coalesce(p_payload, '{}'::jsonb),
      coalesce(p_run_after, now()),
      p_priority,
      p_max_attempts
    )
    on conflict (job_type, dedupe_key)
      where dedupe_key is not null and state in ('queued', 'running')
    do nothing
    returning * into v_job;

    if found then
      return v_job;
    end if;

    select * into v_job
    from public.content_jobs
    where job_type = btrim(p_job_type)
      and dedupe_key = v_dedupe_key
      and state in ('queued', 'running')
    order by created_at desc
    limit 1
    for update;

    if found then
      return v_job;
    end if;
  end loop;

  raise exception 'content job enqueue conflicted with a concurrent state change; retry the request'
    using errcode = '40001';
end;
$$;

revoke execute on function public.enqueue_content_job(text, text, uuid, uuid, jsonb, timestamptz, integer, integer)
from public, anon, authenticated;
grant execute on function public.enqueue_content_job(text, text, uuid, uuid, jsonb, timestamptz, integer, integer)
to service_role;
