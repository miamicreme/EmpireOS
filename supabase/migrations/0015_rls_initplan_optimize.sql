-- =============================================================================
-- Empire OS — RLS initplan optimization
-- Migration: 0015_rls_initplan_optimize
--
-- Every policy created so far calls auth.uid() directly, so Postgres
-- re-evaluates it once PER ROW. Wrapping it in a scalar subselect —
-- (select auth.uid()) — lets the planner hoist it into an InitPlan and evaluate
-- it once per query. This is Supabase's recommended fix for the
-- `auth_rls_initplan` linter warning and matters as tables grow.
--
-- Rather than hand-rewrite every policy, this rebuilds each public policy that
-- references auth.uid() from pg_policies, preserving command, roles,
-- permissive-ness, and USING/WITH CHECK expressions verbatim aside from the
-- auth.uid() -> (select auth.uid()) rewrite. Idempotent: policies already using
-- the subselect form are skipped.
-- =============================================================================
do $$
declare
  r record;
  q text;
  wc text;
  stmt text;
begin
  for r in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
      and coalesce(qual, '') !~* 'select auth\.uid\(\)'
      and coalesce(with_check, '') !~* 'select auth\.uid\(\)'
  loop
    q  := regexp_replace(coalesce(r.qual, ''),       'auth\.uid\(\)', '(select auth.uid())', 'g');
    wc := regexp_replace(coalesce(r.with_check, ''), 'auth\.uid\(\)', '(select auth.uid())', 'g');

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);

    stmt := format('create policy %I on %I.%I as %s for %s to %s',
                   r.policyname, r.schemaname, r.tablename,
                   r.permissive, r.cmd,
                   array_to_string(r.roles, ', '));
    if r.qual is not null then
      stmt := stmt || format(' using (%s)', q);
    end if;
    if r.with_check is not null then
      stmt := stmt || format(' with check (%s)', wc);
    end if;
    execute stmt;
  end loop;
end $$;
