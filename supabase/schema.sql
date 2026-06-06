create extension if not exists pgcrypto;

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  lrn text unique,
  profile_icon text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  school_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  section text,
  grade_level text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists classes_teacher_name_section_unique
  on public.classes (teacher_id, class_name, coalesce(section, ''));

create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  is_active boolean not null default true,
  primary key (class_id, student_id)
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  level_number int not null unique check (level_number between 1 and 15),
  title text not null,
  announcement text,
  geometry_focus text not null,
  shape_icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.levels add column if not exists announcement text;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  title text not null,
  summary text,
  ppt_url text,
  content_markdown text,
  is_published boolean not null default false,
  sort_order int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lessons_level_sort_unique
  on public.lessons (level_id, sort_order);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  instructions text,
  html_url text,
  activity_type text not null check (activity_type in ('quiz', 'problem_solving', 'reflection', 'mixed')),
  is_required boolean not null default true,
  is_published boolean not null default false,
  passing_score int not null default 70 check (passing_score between 0 and 100),
  sort_order int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists activities_level_sort_unique
  on public.activities (level_id, sort_order);

create table if not exists public.activity_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  prompt text not null,
  item_type text not null check (item_type in ('multiple_choice', 'short_answer', 'true_false', 'reflection')),
  options_json jsonb,
  answer_key text,
  max_points int not null default 1,
  explanation text,
  scenario_tag text,
  is_required boolean not null default true,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists activity_items_activity_sort_unique
  on public.activity_items (activity_id, sort_order);

create table if not exists public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  score int,
  max_score int,
  passed boolean,
  feedback_summary text,
  screenshot_path text,
  screenshot_mime_type text,
  screenshot_size_bytes int,
  screenshot_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activity_attempts
  add column if not exists screenshot_path text;

alter table public.activity_attempts
  add column if not exists screenshot_mime_type text;

alter table public.activity_attempts
  add column if not exists screenshot_size_bytes int;

alter table public.activity_attempts
  add column if not exists screenshot_uploaded_at timestamptz;

create index if not exists activity_attempts_student_activity_idx
  on public.activity_attempts (student_id, activity_id, created_at desc);

create table if not exists public.activity_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.activity_attempts(id) on delete cascade,
  item_id uuid not null references public.activity_items(id) on delete cascade,
  response_text text,
  is_correct boolean,
  points_earned int,
  feedback text,
  created_at timestamptz not null default now(),
  unique (attempt_id, item_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  points_bonus int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id uuid references public.levels(id) on delete set null,
  badge_id uuid references public.badges(id) on delete set null,
  reward_type text not null check (reward_type in ('points', 'badge', 'star')),
  points int,
  stars int,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists user_rewards_user_created_idx
  on public.user_rewards (user_id, created_at desc);

create table if not exists public.reflection_prompts (
  id uuid primary key default gen_random_uuid(),
  level_id uuid references public.levels(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  prompt text not null,
  sort_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflection_responses (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.reflection_prompts(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  response_text text not null,
  teacher_feedback text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prompt_id, student_id)
);

create table if not exists public.teacher_notifications (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references auth.users(id) on delete set null,
  level_id uuid references public.levels(id) on delete set null,
  type text not null check (type in ('unfinished_activity', 'flagged_reflection', 'new_submission')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'English',
  font_size text not null default 'default' check (font_size in ('default', 'large', 'x-large')),
  contrast_mode text not null default 'normal' check (contrast_mode in ('normal', 'high')),
  dark_mode boolean not null default false,
  sound_enabled boolean not null default true,
  volume_level int not null default 80 check (volume_level between 0 and 100),
  brightness_level int not null default 50 check (brightness_level between 0 and 100),
  sfx_level int not null default 80 check (sfx_level between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences
  add column if not exists volume_level int not null default 80 check (volume_level between 0 and 100);

alter table public.user_preferences
  add column if not exists brightness_level int not null default 50 check (brightness_level between 0 and 100);

alter table public.user_preferences
  alter column brightness_level set default 50;

alter table public.user_preferences
  add column if not exists sfx_level int not null default 80 check (sfx_level between 0 and 100);

create table if not exists public.level_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_number int not null check (level_number between 1 and 15),
  unlocked boolean not null default false,
  completed boolean not null default false,
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'denied')),
  approval_by uuid references auth.users(id),
  approval_at timestamptz,
  approval_note text,
  best_score int,
  best_time_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, level_number)
);

alter table public.player_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.level_progress enable row level security;
alter table public.app_user_roles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.levels enable row level security;
alter table public.lessons enable row level security;
alter table public.activities enable row level security;
alter table public.activity_items enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.activity_attempt_answers enable row level security;
alter table public.badges enable row level security;
alter table public.user_rewards enable row level security;
alter table public.reflection_prompts enable row level security;
alter table public.reflection_responses enable row level security;
alter table public.teacher_notifications enable row level security;

create or replace function public.is_teacher(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user_roles
    where user_id = target_user
      and role = 'teacher'
  );
$$;

create or replace function public.user_manages_class(target_class uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class
      and (c.teacher_id = target_user or public.is_teacher(target_user))
  );
$$;

create or replace function public.leaderboard_top_students(limit_count int default 10)
returns table (
  student_id uuid,
  student_name text,
  profile_icon text,
  total_points int,
  total_stars int,
  levels_completed int,
  average_score int,
  total_time_seconds int
)
language sql
stable
security definer
set search_path = public
as $$
  with rewards as (
    select
      ur.user_id,
      coalesce(sum(case when ur.reward_type = 'points' then ur.points else 0 end), 0)::int as total_points,
      coalesce(sum(case when ur.reward_type = 'star' then ur.stars else 0 end), 0)::int as total_stars
    from public.user_rewards ur
    group by ur.user_id
  ),
  progress as (
    select
      lp.user_id,
      coalesce(sum(case when lp.completed then 1 else 0 end), 0)::int as levels_completed,
      coalesce(round(avg(case when lp.completed then lp.best_score end)), 0)::int as average_score,
      coalesce(sum(case when lp.completed then lp.best_time_seconds else 0 end), 0)::int as total_time_seconds
    from public.level_progress lp
    group by lp.user_id
  )
  select
    pp.user_id as student_id,
    trim(concat(pp.first_name, ' ', pp.last_name)) as student_name,
    pp.profile_icon,
    coalesce(r.total_points, 0) as total_points,
    coalesce(r.total_stars, 0) as total_stars,
    coalesce(p.levels_completed, 0) as levels_completed,
    coalesce(p.average_score, 0) as average_score,
    coalesce(p.total_time_seconds, 0) as total_time_seconds
  from public.player_profiles pp
  inner join public.app_user_roles aur
    on aur.user_id = pp.user_id
   and aur.role = 'student'
  left join rewards r on r.user_id = pp.user_id
  left join progress p on p.user_id = pp.user_id
  order by
    coalesce(r.total_points, 0) desc,
    coalesce(r.total_stars, 0) desc,
    coalesce(p.levels_completed, 0) desc,
    coalesce(p.average_score, 0) desc,
    coalesce(p.total_time_seconds, 0) asc,
    trim(concat(pp.first_name, ' ', pp.last_name)) asc
  limit greatest(coalesce(limit_count, 10), 1);
$$;

create or replace function public.teacher_visible_students()
returns table (
  student_id uuid,
  first_name text,
  last_name text,
  lrn text,
  profile_icon text,
  onboarding_complete boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pp.user_id as student_id,
    pp.first_name,
    pp.last_name,
    pp.lrn,
    pp.profile_icon,
    pp.onboarding_complete,
    pp.created_at
  from public.player_profiles pp
  inner join public.app_user_roles aur
    on aur.user_id = pp.user_id
   and aur.role = 'student'
  where public.is_teacher()
  order by pp.created_at desc, pp.last_name asc, pp.first_name asc;
$$;

create or replace function public.auto_enroll_student_to_single_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_class_id uuid;
  active_class_count int;
begin
  select count(*)
    into active_class_count
  from public.classes
  where archived = false;

  if active_class_count = 1 then
    select id
      into active_class_id
    from public.classes
    where archived = false
    limit 1;
  end if;

  if active_class_count = 1 then
    if exists (
      select 1
      from public.app_user_roles
      where user_id = new.user_id
        and role = 'student'
    ) then
      insert into public.class_students (class_id, student_id)
      values (active_class_id, new.user_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists auto_enroll_student_to_single_class on public.player_profiles;
create trigger auto_enroll_student_to_single_class
after insert on public.player_profiles
for each row
execute function public.auto_enroll_student_to_single_class();

grant execute on function public.is_teacher(uuid) to authenticated;
grant execute on function public.user_manages_class(uuid, uuid) to authenticated;
grant execute on function public.leaderboard_top_students(int) to authenticated;
grant execute on function public.teacher_visible_students() to authenticated;

drop policy if exists "player_profiles_owner_access" on public.player_profiles;
create policy "player_profiles_owner_access"
  on public.player_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "player_profiles_teacher_read" on public.player_profiles;
create policy "player_profiles_teacher_read"
  on public.player_profiles
  for select
  using (public.is_teacher());

drop policy if exists "user_preferences_owner_access" on public.user_preferences;
create policy "user_preferences_owner_access"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "level_progress_owner_access" on public.level_progress;
create policy "level_progress_owner_access"
  on public.level_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "level_progress_teacher_read" on public.level_progress;
create policy "level_progress_teacher_read"
  on public.level_progress
  for select
  using (public.is_teacher());

drop policy if exists "level_progress_teacher_write" on public.level_progress;
create policy "level_progress_teacher_write"
  on public.level_progress
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "app_user_roles_self_access" on public.app_user_roles;
create policy "app_user_roles_self_access"
  on public.app_user_roles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "app_user_roles_teacher_read_all" on public.app_user_roles;
create policy "app_user_roles_teacher_read_all"
  on public.app_user_roles
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "teacher_profiles_self_access" on public.teacher_profiles;
create policy "teacher_profiles_self_access"
  on public.teacher_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "classes_teacher_access" on public.classes;
create policy "classes_teacher_access"
  on public.classes
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "class_students_owner_or_member_read" on public.class_students;
create policy "class_students_owner_or_member_read"
  on public.class_students
  for select
  using (
    auth.uid() = student_id
    or public.user_manages_class(class_id)
  );

drop policy if exists "class_students_teacher_write" on public.class_students;
create policy "class_students_teacher_write"
  on public.class_students
  for all
  using (public.user_manages_class(class_id))
  with check (public.user_manages_class(class_id));

drop policy if exists "levels_read_authenticated" on public.levels;
create policy "levels_read_authenticated"
  on public.levels
  for select
  using (auth.uid() is not null);

drop policy if exists "levels_teacher_write" on public.levels;
create policy "levels_teacher_write"
  on public.levels
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "lessons_read_published_or_teacher" on public.lessons;
create policy "lessons_read_published_or_teacher"
  on public.lessons
  for select
  using (is_published or public.is_teacher());

drop policy if exists "lessons_teacher_write" on public.lessons;
create policy "lessons_teacher_write"
  on public.lessons
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "activities_read_published_or_teacher" on public.activities;
create policy "activities_read_published_or_teacher"
  on public.activities
  for select
  using (is_published or public.is_teacher());

drop policy if exists "activities_teacher_write" on public.activities;
create policy "activities_teacher_write"
  on public.activities
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "activity_items_read_via_parent" on public.activity_items;
create policy "activity_items_read_via_parent"
  on public.activity_items
  for select
  using (
    exists (
      select 1
      from public.activities a
      where a.id = activity_id
        and (a.is_published or public.is_teacher())
    )
  );

drop policy if exists "activity_items_teacher_write" on public.activity_items;
create policy "activity_items_teacher_write"
  on public.activity_items
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "activity_attempts_student_or_teacher_read" on public.activity_attempts;
create policy "activity_attempts_student_or_teacher_read"
  on public.activity_attempts
  for select
  using (
    auth.uid() = student_id
    or public.is_teacher()
  );

drop policy if exists "activity_attempts_student_insert" on public.activity_attempts;
create policy "activity_attempts_student_insert"
  on public.activity_attempts
  for insert
  with check (auth.uid() = student_id);

drop policy if exists "activity_attempts_student_update" on public.activity_attempts;
create policy "activity_attempts_student_update"
  on public.activity_attempts
  for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "activity_attempts_teacher_update" on public.activity_attempts;
create policy "activity_attempts_teacher_update"
  on public.activity_attempts
  for update
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "activity_attempt_answers_owner_or_teacher" on public.activity_attempt_answers;
create policy "activity_attempt_answers_owner_or_teacher"
  on public.activity_attempt_answers
  for all
  using (
    exists (
      select 1
      from public.activity_attempts aa
      where aa.id = attempt_id
        and (aa.student_id = auth.uid() or public.is_teacher())
    )
  )
  with check (
    exists (
      select 1
      from public.activity_attempts aa
      where aa.id = attempt_id
        and (aa.student_id = auth.uid() or public.is_teacher())
    )
  );

drop policy if exists "badges_read_authenticated" on public.badges;
create policy "badges_read_authenticated"
  on public.badges
  for select
  using (auth.uid() is not null);

drop policy if exists "badges_teacher_write" on public.badges;
create policy "badges_teacher_write"
  on public.badges
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "user_rewards_owner_or_teacher" on public.user_rewards;
create policy "user_rewards_owner_or_teacher"
  on public.user_rewards
  for select
  using (auth.uid() = user_id or public.is_teacher());

drop policy if exists "user_rewards_student_insert_own" on public.user_rewards;
create policy "user_rewards_student_insert_own"
  on public.user_rewards
  for insert
  with check (
    auth.uid() = user_id
    and reward_type in ('points', 'star')
    and coalesce(points, 0) between 0 and 1000
    and coalesce(stars, 0) between 0 and 5
  );

drop policy if exists "user_rewards_teacher_write" on public.user_rewards;
create policy "user_rewards_teacher_write"
  on public.user_rewards
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "reflection_prompts_read_authenticated" on public.reflection_prompts;
create policy "reflection_prompts_read_authenticated"
  on public.reflection_prompts
  for select
  using (auth.uid() is not null);

drop policy if exists "reflection_prompts_teacher_write" on public.reflection_prompts;
create policy "reflection_prompts_teacher_write"
  on public.reflection_prompts
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "reflection_responses_student_or_teacher_read" on public.reflection_responses;
create policy "reflection_responses_student_or_teacher_read"
  on public.reflection_responses
  for select
  using (auth.uid() = student_id or public.is_teacher());

drop policy if exists "reflection_responses_student_write" on public.reflection_responses;
create policy "reflection_responses_student_write"
  on public.reflection_responses
  for insert
  with check (auth.uid() = student_id);

drop policy if exists "reflection_responses_student_update" on public.reflection_responses;
create policy "reflection_responses_student_update"
  on public.reflection_responses
  for update
  using (auth.uid() = student_id and reviewed_by is null)
  with check (auth.uid() = student_id);

drop policy if exists "reflection_responses_teacher_update" on public.reflection_responses;
create policy "reflection_responses_teacher_update"
  on public.reflection_responses
  for update
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "teacher_notifications_teacher_access" on public.teacher_notifications;
create policy "teacher_notifications_teacher_access"
  on public.teacher_notifications
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create or replace view public.teacher_class_progress_summary as
select
  c.id as class_id,
  c.teacher_id,
  c.class_name,
  c.section,
  count(distinct cs.student_id) as student_count,
  count(distinct lp.user_id) filter (where lp.completed = true) as completed_level_records,
  coalesce(avg(lp.best_score) filter (where lp.best_score is not null), 0)::numeric(5,2) as average_best_score,
  max(lp.updated_at) as last_progress_at
from public.classes c
left join public.class_students cs on cs.class_id = c.id and cs.is_active = true
left join public.level_progress lp on lp.user_id = cs.student_id
group by c.id, c.teacher_id, c.class_name, c.section;

create or replace view public.teacher_reflection_queue as
select
  rr.id,
  rr.student_id,
  rr.prompt_id,
  rp.level_id,
  rr.response_text,
  rr.teacher_feedback,
  rr.reviewed_by,
  rr.reviewed_at,
  rr.created_at
from public.reflection_responses rr
join public.reflection_prompts rp on rp.id = rr.prompt_id;

insert into public.levels (level_number, title, geometry_focus, shape_icon, is_active)
select
  level_no,
  'Level ' || level_no,
  case
    when level_no between 1 and 3 then 'Lines and Angles'
    when level_no between 4 and 6 then 'Triangles and Polygons'
    when level_no between 7 and 9 then 'Quadrilaterals'
    when level_no between 10 and 12 then 'Circles and Measurement'
    else 'Solid Geometry'
  end,
  case
    when mod(level_no, 5) = 1 then 'triangle'
    when mod(level_no, 5) = 2 then 'square'
    when mod(level_no, 5) = 3 then 'circle'
    when mod(level_no, 5) = 4 then 'rectangle'
    else 'pyramid'
  end,
  true
from generate_series(1, 15) as level_no
on conflict (level_number) do update
set
  title = excluded.title,
  geometry_focus = excluded.geometry_focus,
  shape_icon = excluded.shape_icon,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.badges (code, name, description, icon, points_bonus)
values
  ('first-clear', 'First Clear', 'Awarded for completing your first activity.', 'badge-first-clear', 10),
  ('geometry-solver', 'Geometry Solver', 'Awarded for passing a level on first try.', 'badge-geometry-solver', 20),
  ('peace-builder', 'Peace Builder', 'Awarded for constructive reflection responses.', 'badge-peace-builder', 15)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  points_bonus = excluded.points_bonus;

-- Seed reflection prompts for different activity types
insert into public.reflection_prompts (prompt, sort_order, is_active)
values
  ('What was the most challenging part of this activity? Why?', 1, true),
  ('How did you feel about your performance on this activity?', 2, true),
  ('What did you learn from completing this activity?', 3, true),
  ('If you could do this activity again, what would you do differently?', 4, true),
  ('Which concept do you feel most confident about now?', 5, true),
  ('What support or resources would help you improve?', 6, true)
on conflict do nothing;

-- Storage bucket for activity HTML uploads
insert into storage.buckets (id, name, public, file_size_limit)
values ('activity-html', 'activity-html', true, 209715200)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "activity_html_public_read" on storage.objects;
create policy "activity_html_public_read"
  on storage.objects
  for select
  using (bucket_id = 'activity-html');

drop policy if exists "activity_html_teacher_insert" on storage.objects;
create policy "activity_html_teacher_insert"
  on storage.objects
  for insert
  with check (bucket_id = 'activity-html' and public.is_teacher());

drop policy if exists "activity_html_teacher_update" on storage.objects;
create policy "activity_html_teacher_update"
  on storage.objects
  for update
  using (bucket_id = 'activity-html' and public.is_teacher())
  with check (bucket_id = 'activity-html' and public.is_teacher());

drop policy if exists "activity_html_teacher_delete" on storage.objects;
create policy "activity_html_teacher_delete"
  on storage.objects
  for delete
  using (bucket_id = 'activity-html' and public.is_teacher());

-- Storage bucket for student activity screenshots
insert into storage.buckets (id, name, public)
values ('activity-screenshots', 'activity-screenshots', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "activity_screenshots_student_select_own" on storage.objects;
create policy "activity_screenshots_student_select_own"
  on storage.objects
  for select
  using (
    bucket_id = 'activity-screenshots'
    and auth.uid() is not null
    and owner = auth.uid()
    and name like auth.uid() || '/%'
  );

drop policy if exists "activity_screenshots_teacher_select" on storage.objects;
create policy "activity_screenshots_teacher_select"
  on storage.objects
  for select
  using (bucket_id = 'activity-screenshots' and public.is_teacher());

drop policy if exists "activity_screenshots_student_insert_own" on storage.objects;
create policy "activity_screenshots_student_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'activity-screenshots'
    and auth.uid() is not null
    and owner = auth.uid()
    and name like auth.uid() || '/%'
  );

drop policy if exists "activity_screenshots_student_update_own" on storage.objects;
create policy "activity_screenshots_student_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'activity-screenshots'
    and auth.uid() is not null
    and owner = auth.uid()
    and name like auth.uid() || '/%'
  )
  with check (
    bucket_id = 'activity-screenshots'
    and auth.uid() is not null
    and owner = auth.uid()
    and name like auth.uid() || '/%'
  );

drop policy if exists "activity_screenshots_student_delete_own" on storage.objects;
create policy "activity_screenshots_student_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'activity-screenshots'
    and auth.uid() is not null
    and owner = auth.uid()
    and name like auth.uid() || '/%'
  );

-- Storage bucket for lesson resource uploads (PPT, PDFs, etc.)
insert into storage.buckets (id, name, public, file_size_limit)
values ('lesson-resources', 'lesson-resources', true, 209715200)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "lesson_resources_public_read" on storage.objects;
create policy "lesson_resources_public_read"
  on storage.objects
  for select
  using (bucket_id = 'lesson-resources');

drop policy if exists "lesson_resources_teacher_insert" on storage.objects;
create policy "lesson_resources_teacher_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'lesson-resources'
    and public.is_teacher()
    and (storage.foldername(name))[1] = 'lessons'
  );

drop policy if exists "lesson_resources_teacher_update" on storage.objects;
create policy "lesson_resources_teacher_update"
  on storage.objects
  for update
  using (bucket_id = 'lesson-resources' and public.is_teacher())
  with check (
    bucket_id = 'lesson-resources'
    and public.is_teacher()
    and (storage.foldername(name))[1] = 'lessons'
  );

drop policy if exists "lesson_resources_teacher_delete" on storage.objects;
create policy "lesson_resources_teacher_delete"
  on storage.objects
  for delete
  using (bucket_id = 'lesson-resources' and public.is_teacher());

-- Realtime setup for teacher auto-refresh subscriptions.
alter table public.activity_attempts replica identity full;
alter table public.level_progress replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'activity_attempts'
    ) then
      alter publication supabase_realtime add table public.activity_attempts;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'level_progress'
    ) then
      alter publication supabase_realtime add table public.level_progress;
    end if;
  end if;
end
$$;
