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

type AttemptRecord = {
  id: string
  activity_id: string
  submitted_at: string | null
  score: number | null
  max_score: number | null
  passed: boolean | null
  screenshot_path: string | null
  screenshot_mime_type: string | null
  screenshot_size_bytes: number | null
  screenshot_uploaded_at: string | null
  activities: {
    title: string | null
  } | {
    title: string | null
  }[] | null
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

  const { data: attemptRows, error: attemptError } = await supabase
    .from("activity_attempts")
    .select("id, activity_id, submitted_at, score, max_score, passed, screenshot_path, screenshot_mime_type, screenshot_size_bytes, screenshot_uploaded_at, activities(title)")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  const latestByActivity = new Set<string>()
  const attempts = ((attemptRows ?? []) as AttemptRecord[])
    .filter((row) => {
      if (latestByActivity.has(row.activity_id)) {
        return false
      }

      latestByActivity.add(row.activity_id)
      return true
    })
    .map((row) => {
      const relatedActivity = Array.isArray(row.activities) ? row.activities[0] : row.activities
      return {
        id: row.id,
        activity_id: row.activity_id,
        activity_title: relatedActivity?.title ?? "Untitled Activity",
        submitted_at: row.submitted_at,
        score: row.score,
        max_score: row.max_score,
        passed: row.passed,
        score_percent:
          typeof row.score === "number" && typeof row.max_score === "number" && row.max_score > 0
            ? Math.round((row.score / row.max_score) * 100)
            : null,
        screenshot: {
          available: Boolean(row.screenshot_path),
          mime_type: row.screenshot_mime_type,
          size_bytes: row.screenshot_size_bytes,
          uploaded_at: row.screenshot_uploaded_at,
        },
      }
    })

  return NextResponse.json({
    progress,
    attempts,
  })
}
