-- The board's per-status counts, in one round trip.
--
-- The filter pills on `/announcements` need "how many drafts, how many scheduled, how many
-- published, how many archived" for one village, and the board's own headline needs the sum of
-- all four. Five separate `count: "exact", head: true` reads (one per status, one for the total)
-- is five round trips to answer four numbers; PostgREST's own grouped-count feature
-- (`select=status,count()`) would answer it in one, but it is switched off here — confirmed
-- against the local stack, not assumed: `db-aggregates-enabled` is off by default, is not a
-- setting the Supabase CLI's `config.toml` exposes, and asking for it anyway returns
-- `PGRST123 Use of aggregate functions is not allowed`. A SQL function is the next-cheapest
-- correct instrument: still one round trip, and — unlike fetching every row to count them in
-- JS — its result set is four rows regardless of how large the village's board ever grows.
--
-- `security invoker`, not `security definer`, and that is the load-bearing choice: run under the
-- caller's own role, this function sees exactly the rows `announcements_select` already lets the
-- caller see (a manager holding `announcements.create` sees every status; anyone else would see
-- only published-and-past, though nothing in this feature calls it as anyone else). That is the
-- same visibility the paginated list already relies on, so counting here cannot disagree with
-- what the list can show — no second copy of the tenancy or capability rule to keep in step.
--
-- `p_now` is a parameter rather than a bare `now()` in the CASE, so a caller reading the list and
-- the counts in the same request can pass one `Date` to both and get a "scheduled" cutoff that
-- cannot fall between two separate reads.
create or replace function public.announcement_status_counts(
  p_village uuid,
  p_now timestamptz default now()
)
returns table (status text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case
      when a.status = 'published' and a.publish_at > p_now then 'scheduled'
      else a.status::text
    end as status,
    count(*) as total
  from public.announcements a
  where a.village_id = p_village
  group by 1;
$$;

-- Same trap `20260908130000_user_permission_keys.sql` documents: CREATE FUNCTION grants EXECUTE
-- to PUBLIC, and revoking from a role does not touch a grant made to PUBLIC, so anon inherits it
-- either way unless PUBLIC's own grant is revoked first.
revoke all on function public.announcement_status_counts(uuid, timestamptz) from public, anon;
grant execute on function public.announcement_status_counts(uuid, timestamptz) to authenticated;
