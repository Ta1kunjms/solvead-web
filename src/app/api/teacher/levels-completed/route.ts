import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

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

export async function GET(request: NextRequest) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { searchParams } = new URL(request.url)
  const classId = searchParams.get("classId")

  if (classId) {
    const { data: classStudents } = await supabase
      .from("class_students")
      .select("user_id")
      .eq("class_id", classId)
      .eq("is_active", true)

    if (classStudents && classStudents.length > 0) {
      const studentIds = classStudents.map((s) => s.user_id)
      const { data: completedData, error: completedError } = await supabase
        .from("level_progress")
        .select("level_number")
        .eq("completed", true)
        .in("user_id", studentIds)

      if (completedError) {
        return NextResponse.json({ error: completedError.message }, { status: 500 })
      }

      const levelCompleted = new Map<number, number>()
      for (const row of completedData || []) {
        const current = levelCompleted.get(row.level_number) || 0
        levelCompleted.set(row.level_number, current + 1)
      }

      const result = Array.from({ length: 15 }, (_, i) => {
        const level = i + 1
        return {
          level_number: level,
          students_completed: levelCompleted.get(level) || 0,
          students_not_completed: classStudents.length - (levelCompleted.get(level) || 0),
        }
      })

      return NextResponse.json({ data: result })
    }
  }

  try {
    const { data: studentRoles, error: studentRolesError } = await supabase
      .from("app_user_roles")
      .select("user_id, role")
      .eq("role", "student")

    if (studentRolesError) {
      console.error("studentRolesError:", studentRolesError)
      return NextResponse.json({ error: "Failed to get students: " + studentRolesError.message }, { status: 500 })
    }

    const totalStudents = studentRoles?.length || 0
    
    const { data: completedData, error: completedError } = await supabase
      .from("level_progress")
      .select("level_number")
      .eq("completed", true)

    if (completedError) {
      console.error("completedError:", completedError)
      return NextResponse.json({ error: "Failed to get progress: " + completedError.message }, { status: 500 })
    }

    const levelCompleted = new Map<number, number>()
    for (const row of completedData || []) {
      const current = levelCompleted.get(row.level_number) || 0
      levelCompleted.set(row.level_number, current + 1)
    }

    const result = Array.from({ length: 15 }, (_, i) => {
      const level = i + 1
      return {
        level_number: level,
        students_completed: levelCompleted.get(level) || 0,
        students_not_completed: totalStudents - (levelCompleted.get(level) || 0),
      }
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error("catch error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}