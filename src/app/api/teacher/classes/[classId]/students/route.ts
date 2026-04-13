import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Params = {
  classId: string
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

async function ensureClassExists(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>, classId: string) {
  if (!supabase) {
    return false
  }

  const { data: classRow } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle()

  return Boolean(classRow)
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { classId } = await params

  if (!(await ensureClassExists(supabase, classId))) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  const body = await request.json()
  const lrn = typeof body.lrn === "string" ? body.lrn.trim() : ""

  if (!lrn) {
    return NextResponse.json({ error: "LRN is required" }, { status: 400 })
  }

  const { data: studentProfile, error: profileError } = await supabase
    .from("player_profiles")
    .select("user_id, first_name, last_name, lrn")
    .eq("lrn", lrn)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!studentProfile) {
    return NextResponse.json({ error: "No student profile found for that LRN" }, { status: 404 })
  }

  const { error: upsertError } = await supabase.from("class_students").upsert(
    {
      class_id: classId,
      student_id: studentProfile.user_id,
      is_active: true,
    },
    { onConflict: "class_id,student_id" }
  )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  return NextResponse.json({
    message: "Student added to class",
    student: studentProfile,
  }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { classId } = await params

  if (!(await ensureClassExists(supabase, classId))) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const studentId = typeof body.studentId === "string" ? body.studentId : ""

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("class_students")
    .update({ is_active: false })
    .eq("class_id", classId)
    .eq("student_id", studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ message: "Student removed from class" })
}
