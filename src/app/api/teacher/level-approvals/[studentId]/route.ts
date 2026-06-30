import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

type Params = {
  params: Promise<{
    studentId: string
  }>
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

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth
  const { studentId } = await params
  const { searchParams } = new URL(request.url)
  const level = searchParams.get("level")

  const query = supabase
    .from("level_progress")
    .select("level_number, unlocked, completed, approval_status, approval_by, approval_at, approval_note, best_score, updated_at")
    .eq("user_id", studentId)

  if (level) {
    query.eq("level_number", parseInt(level, 10))
  }

  const { data: progress, error } = await query.order("level_number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from("activity_attempts")
    .select(`
      id,
      activity_id,
      submitted_at,
      score,
      max_score,
      passed,
      screenshot_path,
      screenshot_mime_type,
      screenshot_size_bytes,
      screenshot_uploaded_at,
      text_response,
      activities:activities(
        id,
        title,
        activity_type,
        output_type,
        button_label
      )
    `)
    .eq("student_id", studentId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(10)

  if (attemptsError) {
    return NextResponse.json({ error: attemptsError.message }, { status: 500 })
  }

  const formattedAttempts = (attempts ?? []).map((attempt: Record<string, any>) => {
    const activity = attempt.activities as { id: string; title: string; activity_type: string; output_type: string; button_label: string } | null
    const score = attempt.score as number | null
    const maxScore = attempt.max_score as number | null
    const scorePercent = maxScore && maxScore > 0 && score !== null ? Math.round((score / maxScore) * 100) : null

    return {
      id: attempt.id,
      activity_id: attempt.activity_id,
      activity_title: activity?.title ?? "Unknown Activity",
      submitted_at: attempt.submitted_at,
      score,
      max_score: maxScore,
      score_percent: scorePercent,
      passed: attempt.passed,
      screenshot: {
        available: !!attempt.screenshot_path,
        mime_type: attempt.screenshot_mime_type,
        size_bytes: attempt.screenshot_size_bytes,
        uploaded_at: attempt.screenshot_uploaded_at,
      },
      screenshot_url: attempt.screenshot_path,
      text_response: attempt.text_response,
      activities: activity,
    }
  })

  return NextResponse.json({
    progress: progress || [],
    attempts: formattedAttempts,
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: roleRecord } = await supabase.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle()

  if (roleRecord?.role !== "teacher") {
    return NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 })
  }

  const { studentId } = await params
  const body = await request.json()
  const { level_number, approval_status, approval_note } = body

  if (!level_number || !approval_status) {
    return NextResponse.json({ error: "level_number and approval_status are required" }, { status: 400 })
  }

  if (!["approved", "denied"].includes(approval_status)) {
    return NextResponse.json({ error: "approval_status must be 'approved' or 'denied'" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    approval_status,
    approval_by: user.id,
    approval_at: new Date().toISOString(),
  }

  if (approval_note) {
    updates.approval_note = approval_note
  }

  if (approval_status === "approved") {
    updates.unlocked = true

    const nextLevel = level_number + 1
    if (nextLevel <= 15) {
      const admin = getSupabaseAdmin()
      if (admin) {
        const { error: nextLevelError } = await admin
          .from("level_progress")
          .upsert({
            user_id: studentId,
            level_number: nextLevel,
            unlocked: true,
            approval_status: "approved",
          }, {
            onConflict: "user_id,level_number",
          })

        if (nextLevelError) {
          console.error("Failed to unlock next level:", nextLevelError)
        }
      }
    }
  } else if (approval_status === "denied") {
    updates.unlocked = false
  }

  const { error } = await supabase
    .from("level_progress")
    .update(updates)
    .eq("user_id", studentId)
    .eq("level_number", level_number)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mark any pending-approval notifications for this student + level as read,
  // so the teacher's UI badge decrements once they have acted on the request.
  // We look up the matching level_id (level_progress.level_number -> levels.id) first.
  try {
    const { data: levelRow } = await supabase
      .from("levels")
      .select("id")
      .eq("level_number", level_number)
      .maybeSingle()

    if (levelRow?.id) {
      await supabase
        .from("teacher_notifications")
        .update({ is_read: true })
        .eq("student_id", studentId)
        .eq("level_id", levelRow.id)
        .eq("type", "level_pending_approval")
        .eq("is_read", false)
    }
  } catch (notificationError) {
    console.error("Failed to mark teacher_notifications as read", notificationError)
  }

  return NextResponse.json({ success: true })
}