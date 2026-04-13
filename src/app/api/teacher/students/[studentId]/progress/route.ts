import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Params = {
  studentId: string
}

type LevelProgressRecord = {
  level_number: number
  completed: boolean
  best_score: number | null
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

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { studentId } = await params

  const { data: progressRows, error: progressError } = await supabase
    .from("level_progress")
    .select("level_number, completed, best_score")
    .eq("user_id", studentId)
    .order("level_number", { ascending: true })

  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 })
  }

  const progress = (progressRows ?? []) as LevelProgressRecord[]

  return NextResponse.json({
    progress,
  })
}
