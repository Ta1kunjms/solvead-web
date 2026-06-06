-- Migration: 20260606_level_progression_fixes.sql
-- Applies the database-side changes required by the 6 student-level-progression fixes.
-- Safe to run more than once.

begin;

-- 1. Extend the teacher_notifications.type check constraint to allow the new
--    'level_pending_approval' type. We give the new constraint an explicit name
--    so it can be replaced cleanly without scanning pg_constraint by regex.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'teacher_notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%type%in%'
  loop
    execute format('alter table public.teacher_notifications drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.teacher_notifications
  add constraint teacher_notifications_type_check
  check (type in ('unfinished_activity', 'flagged_reflection', 'new_submission', 'level_pending_approval'));

-- 2. Indexes that support the new notification queries.
create index if not exists teacher_notifications_teacher_unread_idx
  on public.teacher_notifications (teacher_id, is_read, created_at desc);

create index if not exists teacher_notifications_student_level_idx
  on public.teacher_notifications (student_id, level_id, is_read);

-- 3. Trigger that auto-seeds level_progress the moment a player_profiles row
--    appears. Level 1 is unlocked + approved; Levels 2..15 are locked + pending.
--    on conflict ... do nothing keeps the operation idempotent for backfills.
create or replace function public.seed_level_progress_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.level_progress (user_id, level_number, unlocked, approval_status)
  values
    (new.user_id, 1,  true,  'approved'),
    (new.user_id, 2,  false, 'pending'),
    (new.user_id, 3,  false, 'pending'),
    (new.user_id, 4,  false, 'pending'),
    (new.user_id, 5,  false, 'pending'),
    (new.user_id, 6,  false, 'pending'),
    (new.user_id, 7,  false, 'pending'),
    (new.user_id, 8,  false, 'pending'),
    (new.user_id, 9,  false, 'pending'),
    (new.user_id, 10, false, 'pending'),
    (new.user_id, 11, false, 'pending'),
    (new.user_id, 12, false, 'pending'),
    (new.user_id, 13, false, 'pending'),
    (new.user_id, 14, false, 'pending'),
    (new.user_id, 15, false, 'pending')
  on conflict (user_id, level_number) do nothing;

  return new;
end;
$$;

drop trigger if exists auto_seed_level_progress on public.player_profiles;
create trigger auto_seed_level_progress
  after insert on public.player_profiles
  for each row
  execute function public.seed_level_progress_for_new_user();

grant execute on function public.seed_level_progress_for_new_user() to authenticated;

commit;

-- Post-migration sanity checks (run these manually in the SQL editor):
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.teacher_notifications'::regclass
--     and contype = 'c';
--   select tgname from pg_trigger where tgrelid = 'public.player_profiles'::regclass;
--   select level_number, unlocked, approval_status
--   from public.level_progress
--   where user_id = '<a test student id>';
