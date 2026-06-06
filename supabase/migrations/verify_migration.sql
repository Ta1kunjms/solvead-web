-- 1. New check constraint is in place and lists the new value
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.teacher_notifications'::regclass and contype = 'c';

-- 2. Trigger is attached to player_profiles
select tgname from pg_trigger
where tgrelid = 'public.player_profiles'::regclass and not tgisinternal;

-- 3. Show the first 5 students in the system (copy one of the user_ids below
--    and paste it into query 4)
select pp.user_id, pp.first_name, pp.last_name, pp.created_at
from public.player_profiles pp
order by pp.created_at desc
limit 5;

-- 4. After you have a real uuid from query 3, run this (replace the uuid):
select level_number, unlocked, approval_status
from public.level_progress
where user_id = '00000000-0000-0000-0000-000000000000'  -- paste real uuid here
order by level_number;

-- 5. Per-user row count to spot any students missing rows
select pp.user_id, pp.first_name, pp.last_name,
       count(lp.level_number) as rows_seeded
from public.player_profiles pp
left join public.level_progress lp on lp.user_id = pp.user_id
group by pp.user_id, pp.first_name, pp.last_name
order by rows_seeded asc, pp.created_at desc
limit 10;
