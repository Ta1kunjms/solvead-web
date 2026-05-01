import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

type StudentDirectoryEntry = {
  student_id: string
  first_name: string
  last_name: string
  lrn: string | null
  profile_icon: string | null
  onboarding_complete: boolean
  created_at: string
}

async function requireTeacher() {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return { supabase: null, error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: roleRecord } = await supabase.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle()

  if (roleRecord?.role !== "teacher") {
    return { supabase, error: NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 }) }
  }

  return { supabase, error: null }
}

export async function GET() {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { data: studentDirectory, error: studentDirectoryError } = await supabase.rpc("teacher_visible_students")

  if (studentDirectoryError) {
    return NextResponse.json({ error: studentDirectoryError.message }, { status: 500 })
  }

  const students = ((studentDirectory ?? []) as StudentDirectoryEntry[]).filter(Boolean)

  return NextResponse.json({
    students,
    total_visible_students: students.length,
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const studentId = typeof body.studentId === "string" ? body.studentId : ""

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 })
  }

  const { error } = await admin.auth.admin.deleteUser(studentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ message: "Student and all related data deleted successfully" })
}