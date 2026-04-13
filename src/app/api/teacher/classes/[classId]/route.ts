import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Params = {
  classId: string
}

type ClassRecord = {
  id: string
  class_name: string
  section: string | null
  grade_level: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

type SummaryRecord = {
  class_id: string
  class_name: string
  section: string | null
  student_count: number
  average_best_score: number
  last_progress_at: string | null
}

type StudentProfile = {
  user_id: string
  first_name: string
  last_name: string
  lrn: string | null
}

type RosterRecord = {
  student_id: string
  enrolled_at: string
  is_active: boolean
  first_name: string | null
  last_name: string | null
  lrn: string | null
  completed_levels: number
  best_score: number | null
}

async function requireTeacher() {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return { supabase: null, userId: null, error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: roleRecord } = await supabase.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle()

  if (roleRecord?.role !== "teacher") {
    return { supabase, userId: null, error: NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 }) }
  }

  return { supabase, userId: user.id, error: null }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { classId } = await params

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, class_name, section, grade_level, archived, created_at, updated_at")
    .eq("id", classId)
    .maybeSingle<ClassRecord>()

  if (classError) {
    return NextResponse.json({ error: classError.message }, { status: 500 })
  }

  if (!classRow) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  const { data: summaryRow } = await supabase
    .from("teacher_class_progress_summary")
    .select("class_id, class_name, section, student_count, average_best_score, last_progress_at")
    .eq("class_id", classId)
    .maybeSingle<SummaryRecord>()

  const { data: rosterRows, error: rosterError } = await supabase
    .from("class_students")
    .select("student_id, enrolled_at, is_active")
    .eq("class_id", classId)
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false })

  if (rosterError) {
    return NextResponse.json({ error: rosterError.message }, { status: 500 })
  }

  const studentIds = (rosterRows ?? []).map((row) => row.student_id)

  const [{ data: profiles }, { data: progressRows }] = await Promise.all([
    studentIds.length > 0
      ? supabase.from("player_profiles").select("user_id, first_name, last_name, lrn").in("user_id", studentIds)
      : Promise.resolve({ data: [] as StudentProfile[] }),
    studentIds.length > 0
      ? supabase.from("level_progress").select("user_id, completed, best_score").in("user_id", studentIds)
      : Promise.resolve({ data: [] as { user_id: string; completed: boolean; best_score: number | null }[] }),
  ])

  const profileMap = new Map((profiles ?? []).map((profile: StudentProfile) => [profile.user_id, profile]))
  const progressMap = new Map<string, { completedLevels: number; bestScore: number | null }>()

  for (const row of progressRows ?? []) {
    const current = progressMap.get(row.user_id) ?? { completedLevels: 0, bestScore: null }
    progressMap.set(row.user_id, {
      completedLevels: current.completedLevels + (row.completed ? 1 : 0),
      bestScore:
        row.best_score === null
          ? current.bestScore
          : current.bestScore === null
            ? row.best_score
            : Math.max(current.bestScore, row.best_score),
    })
  }

  const roster: RosterRecord[] = (rosterRows ?? []).map((row) => {
    const profile = profileMap.get(row.student_id)
    const progress = progressMap.get(row.student_id) ?? { completedLevels: 0, bestScore: null }

    return {
      student_id: row.student_id,
      enrolled_at: row.enrolled_at,
      is_active: row.is_active,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      lrn: profile?.lrn ?? null,
      completed_levels: progress.completedLevels,
      best_score: progress.bestScore,
    }
  })
  const { data: studentDirectory, error: studentDirectoryError } = await supabase.rpc("teacher_visible_students")
  const totalVisibleStudents = studentDirectoryError ? null : (studentDirectory ?? []).filter(Boolean).length

  return NextResponse.json({
    class: classRow,
    summary: summaryRow ?? null,
    roster,
    total_visible_students: totalVisibleStudents,
    total_visible_students_error: studentDirectoryError?.message ?? null,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { classId } = await params
  const body = await request.json()

  const updates: Record<string, string | boolean | null> = {}

  if (typeof body.class_name === "string") {
    updates.class_name = body.class_name.trim()
  }
  if (typeof body.section === "string") {
    updates.section = body.section.trim() || null
  }
  if (typeof body.grade_level === "string") {
    updates.grade_level = body.grade_level.trim() || null
  }
  if (typeof body.archived === "boolean") {
    updates.archived = body.archived
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("classes")
    .update(updates)
    .eq("id", classId)
    .select("id, class_name, section, grade_level, archived, created_at, updated_at")
    .maybeSingle<ClassRecord>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  return NextResponse.json({ class: data })
}
