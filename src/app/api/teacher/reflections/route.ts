import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type TeacherReflectionRow = {
  id: string
  student_id: string
  prompt_id: string
  response_text: string
  teacher_feedback: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

type StudentProfileRow = {
  user_id: string
  first_name: string
  last_name: string
  lrn: string | null
}

type ReflectionPromptRow = {
  id: string
  prompt: string
  level_id: string | null
  activity_id: string | null
  levels: { level_number: number; title: string }[] | { level_number: number; title: string } | null
  activities: { title: string; activity_type: string }[] | { title: string; activity_type: string } | null
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

function pickFirstRelation<T>(value: T[] | T | null) {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function GET() {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth

  const { data: reflections, error } = await supabase
    .from("reflection_responses")
    .select("id, student_id, prompt_id, response_text, teacher_feedback, reviewed_by, reviewed_at, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const studentIds = [...new Set((reflections ?? []).map((row: TeacherReflectionRow) => row.student_id))]
  const promptIds = [...new Set((reflections ?? []).map((row: TeacherReflectionRow) => row.prompt_id))]

  const [{ data: profiles }, { data: prompts }] = await Promise.all([
    studentIds.length > 0
      ? supabase.from("player_profiles").select("user_id, first_name, last_name, lrn").in("user_id", studentIds)
      : Promise.resolve({ data: [] as StudentProfileRow[] }),
    promptIds.length > 0
      ? supabase
          .from("reflection_prompts")
          .select("id, prompt, level_id, activity_id, levels(level_number, title), activities(title, activity_type)")
          .in("id", promptIds)
      : Promise.resolve({ data: [] as ReflectionPromptRow[] }),
  ])

  const profileMap = new Map((profiles ?? []).map((profile: StudentProfileRow) => [profile.user_id, profile]))
  const promptMap = new Map((prompts ?? []).map((prompt: ReflectionPromptRow) => [prompt.id, prompt]))

  const payload = (reflections ?? []).map((row: TeacherReflectionRow) => {
    const profile = profileMap.get(row.student_id)
    const prompt = promptMap.get(row.prompt_id)
    const levelRelation = pickFirstRelation(prompt?.levels ?? null)
    const activityRelation = pickFirstRelation(prompt?.activities ?? null)

    return {
      ...row,
      student_name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Unknown Student",
      student_lrn: profile?.lrn ?? null,
      prompt_text: prompt?.prompt ?? "Unknown prompt",
      level_number: levelRelation?.level_number ?? null,
      level_title: levelRelation?.title ?? null,
      activity_title: activityRelation?.title ?? null,
      activity_type: activityRelation?.activity_type ?? null,
    }
  })

  return NextResponse.json({ reflections: payload })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase, userId } = auth
  const body = await request.json().catch(() => ({}))
  const reflectionId = typeof body.reflectionId === "string" ? body.reflectionId.trim() : ""
  const teacherFeedback = typeof body.teacher_feedback === "string" ? body.teacher_feedback.trim() : ""
  const reviewed = typeof body.reviewed === "boolean" ? body.reviewed : true

  if (!reflectionId) {
    return NextResponse.json({ error: "reflectionId is required" }, { status: 400 })
  }

  const updatePayload: Record<string, string | null> = {
    teacher_feedback: teacherFeedback || null,
    reviewed_by: reviewed ? userId : null,
    reviewed_at: reviewed ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from("reflection_responses")
    .update(updatePayload)
    .eq("id", reflectionId)
    .select("id, student_id, prompt_id, response_text, teacher_feedback, reviewed_by, reviewed_at, created_at")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Reflection not found" }, { status: 404 })
  }

  return NextResponse.json({ reflection: data })
}
