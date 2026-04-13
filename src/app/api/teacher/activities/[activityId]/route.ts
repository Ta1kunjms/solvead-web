import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Params = {
  activityId: string
}

type ActivityPayload = {
  title?: string
  instructions?: string | null
  activity_type?: "quiz" | "problem_solving" | "reflection" | "mixed"
  passing_score?: number
  is_required?: boolean
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

async function verifyActivityAccess(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  activityId: string,
  userId: string,
) {
  const { data: activity } = await supabase
    .from("activities")
    .select("id, created_by")
    .eq("id", activityId)
    .maybeSingle()

  if (!activity) {
    return false
  }

  if (activity.created_by && activity.created_by !== userId) {
    return false
  }

  return true
}

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase, userId } = auth
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { activityId } = await params

  if (!(await verifyActivityAccess(supabase, activityId, userId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("activities")
    .select("id, level_id, title, instructions, html_url, activity_type, passing_score, is_required, is_published, sort_order")
    .eq("id", activityId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  }

  return NextResponse.json({ activity: data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase, userId } = auth
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { activityId } = await params

  if (!(await verifyActivityAccess(supabase, activityId, userId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  }

  const body: ActivityPayload = await request.json().catch(() => ({}))
  const updates: ActivityPayload = {}

  if (typeof body.title === "string") updates.title = body.title.trim()
  if (typeof body.instructions !== "undefined") updates.instructions = typeof body.instructions === "string" ? body.instructions : null
  if (typeof body.activity_type === "string") updates.activity_type = body.activity_type
  if (typeof body.passing_score === "number") updates.passing_score = Math.max(0, Math.min(100, Math.floor(body.passing_score)))
  if (typeof body.is_required === "boolean") updates.is_required = body.is_required
  if (typeof body.is_published === "boolean") updates.is_published = body.is_published
  if (typeof body.sort_order === "number") updates.sort_order = Math.max(1, Math.floor(body.sort_order))

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("activities")
    .update(updates)
    .eq("id", activityId)
    .select("id, level_id, title, instructions, html_url, activity_type, passing_score, is_required, is_published, sort_order")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  }

  return NextResponse.json({ activity: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher()
  if (auth.error) {
    return auth.error
  }

  const { supabase, userId } = auth
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { activityId } = await params

  if (!(await verifyActivityAccess(supabase, activityId, userId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  }

  const { error } = await supabase.from("activities").delete().eq("id", activityId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
