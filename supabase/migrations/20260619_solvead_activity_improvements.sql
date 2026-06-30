-- 1. Drop old activity_type check constraint and replace with expanded types
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_activity_type_check;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN (
    'quiz', 'graded', 'motivation', 'reading', 'reference',
    'game', 'other', 'problem_solving', 'reflection', 'mixed'
  ));

-- 2. Add output_type column
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS output_type TEXT NOT NULL DEFAULT 'none'
  CHECK (output_type IN ('none', 'photo', 'file', 'text'));

-- 3. Add button_label column
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS button_label VARCHAR(50) NOT NULL DEFAULT 'Open Activity';

-- 4. Add text_response to activity_attempts
ALTER TABLE public.activity_attempts
  ADD COLUMN IF NOT EXISTS text_response TEXT;

-- 5. Drop old owner-only RLS policies
DROP POLICY IF EXISTS activities_update_owner ON public.activities;
DROP POLICY IF EXISTS activities_delete_owner ON public.activities;

-- 6. Add new teacher-wide RLS policies
DROP POLICY IF EXISTS activities_update_teacher ON public.activities;
DROP POLICY IF EXISTS activities_delete_teacher ON public.activities;

CREATE POLICY activities_update_teacher ON public.activities
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_user_roles
      WHERE app_user_roles.user_id = auth.uid()
      AND app_user_roles.role = 'teacher'
    )
  );

CREATE POLICY activities_delete_teacher ON public.activities
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_user_roles
      WHERE app_user_roles.user_id = auth.uid()
      AND app_user_roles.role = 'teacher'
    )
  );
