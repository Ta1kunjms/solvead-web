import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Params = {
  lessonId: string
}

type LessonPayload = {
  title?: string
  summary?: string | null
  content_markdown?: string | null
  ppt_url?: string | null
  is_published?: boolean
  sort_order?: number
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

async function verifyLessonAccess(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  lessonId: string,
) {
  const { data: lesson } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle()

  return Boolean(lesson)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { lessonId } = await params

  if (!(await verifyLessonAccess(supabase, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("lessons")
    .select("id, level_id, title, summary, content_markdown, ppt_url, is_published, sort_order, created_by")
    .eq("id", lessonId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  return NextResponse.json({ lesson: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { lessonId } = await params

  if (!(await verifyLessonAccess(supabase, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const updates: LessonPayload = {}

  if (typeof body.title === "string") updates.title = body.title.trim()
  if (typeof body.summary !== "undefined") updates.summary = typeof body.summary === "string" ? body.summary.trim() || null : null
  if (typeof body.content_markdown !== "undefined") updates.content_markdown = typeof body.content_markdown === "string" ? body.content_markdown : null
  if (typeof body.ppt_url !== "undefined") updates.ppt_url = typeof body.ppt_url === "string" ? body.ppt_url.trim() || null : null
  if (typeof body.is_published === "boolean") updates.is_published = body.is_published
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("lessons")
    .update(updates)
    .eq("id", lessonId)
    .select("id, level_id, title, summary, content_markdown, ppt_url, is_published, sort_order, created_by")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  return NextResponse.json({ lesson: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase } = auth

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { lessonId } = await params

  if (!(await verifyLessonAccess(supabase, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
