import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type TeacherClassRow = {
  id: string
  teacher_id: string
  class_name: string
  section: string | null
  grade_level: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

type ClassSummaryRow = {
  class_id: string
  student_count: number
  average_best_score: number
  last_progress_at: string | null
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

export async function GET() {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth

  const [
    { data: classes, error: classError },
    { data: summaries, error: summaryError },
    { data: studentDirectory, error: studentDirectoryError },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, teacher_id, class_name, section, grade_level, archived, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_class_progress_summary")
      .select("class_id, student_count, average_best_score, last_progress_at"),
    supabase.rpc("teacher_visible_students"),
  ])

  if (classError) {
    return NextResponse.json({ error: classError.message }, { status: 500 })
  }

  if (summaryError) {
    return NextResponse.json({ error: summaryError.message }, { status: 500 })
  }

  const summaryMap = new Map((summaries ?? []).map((row: ClassSummaryRow) => [row.class_id, row]))
  const totalVisibleStudents = studentDirectoryError ? null : (studentDirectory ?? []).filter(Boolean).length

  const payload = (classes ?? []).map((row: TeacherClassRow) => ({
    ...row,
    student_count: summaryMap.get(row.id)?.student_count ?? 0,
    average_best_score: summaryMap.get(row.id)?.average_best_score ?? 0,
    last_progress_at: summaryMap.get(row.id)?.last_progress_at ?? null,
  }))

  return NextResponse.json({
    classes: payload,
    total_visible_students: totalVisibleStudents,
    total_visible_students_error: studentDirectoryError?.message ?? null,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase, userId } = auth
  const body = await request.json()
  const className = typeof body.class_name === "string" ? body.class_name.trim() : ""
  const section = typeof body.section === "string" ? body.section.trim() : ""
  const gradeLevel = typeof body.grade_level === "string" ? body.grade_level.trim() : ""

  if (!className) {
    return NextResponse.json({ error: "Class name is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({
      teacher_id: userId,
      class_name: className,
      section: section || null,
      grade_level: gradeLevel || null,
    })
    .select("id, teacher_id, class_name, section, grade_level, archived, created_at, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ class: data }, { status: 201 })
}
