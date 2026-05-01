import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { SCREENSHOT_BUCKET } from "@/lib/screenshot"

type Params = {
  studentId: string
  attemptId: string
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
  const { studentId, attemptId } = await params

  const { data: attempt, error: attemptError } = await supabase
    .from("activity_attempts")
    .select("id, student_id, screenshot_path, screenshot_mime_type, screenshot_size_bytes, screenshot_uploaded_at")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
  }

  if (!attempt.screenshot_path) {
    return NextResponse.json({ error: "Screenshot not available for this attempt" }, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(attempt.screenshot_path, 60)

  if (signedUrlError) {
    return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      attempt_id: attempt.id,
      student_id: attempt.student_id,
      screenshot_available: true,
      screenshot_mime_type: attempt.screenshot_mime_type,
      screenshot_size_bytes: attempt.screenshot_size_bytes,
      screenshot_uploaded_at: attempt.screenshot_uploaded_at,
      preview_url: signedUrlData.signedUrl,
      expires_in_seconds: 60,
    },
    { status: 200 },
  )
}