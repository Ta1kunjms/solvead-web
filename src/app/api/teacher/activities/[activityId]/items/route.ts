import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Params = {
  activityId: string
}

type ActivityItemPayload = {
  prompt: string
  item_type: "multiple_choice" | "short_answer" | "true_false" | "reflection"
  max_points: number
  answer_key?: string | null
  explanation?: string | null
  scenario_tag?: string | null
  is_required?: boolean
  options_json?: { choices?: string[] } | null
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
    .select("id")
    .eq("id", activityId)
    .maybeSingle()

  return !!activity;
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
    .from("activity_items")
    .select("id, prompt, item_type, max_points, answer_key, explanation, scenario_tag, is_required, options_json, sort_order")
    .eq("activity_id", activityId)
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
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

  const payload: ActivityItemPayload = await request.json()
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : ""

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
  }

  const sortOrder = typeof payload.sort_order === "number" ? payload.sort_order : 1

  const { data, error } = await supabase
    .from("activity_items")
    .insert({
      activity_id: activityId,
      prompt,
      item_type: payload.item_type,
      max_points: Number.isFinite(payload.max_points) ? payload.max_points : 1,
      answer_key: payload.answer_key || null,
      explanation: payload.explanation || null,
      scenario_tag: payload.scenario_tag || null,
      is_required: payload.is_required ?? true,
      options_json: payload.options_json || null,
      sort_order: sortOrder,
    })
    .select("id, prompt, item_type, max_points, answer_key, explanation, scenario_tag, is_required, options_json, sort_order")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
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

  const body = await request.json().catch(() => ({}))
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : ""

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {}

  if (typeof body.prompt === "string") updatePayload.prompt = body.prompt.trim()
  if (typeof body.item_type === "string") updatePayload.item_type = body.item_type
  if (typeof body.max_points === "number") updatePayload.max_points = body.max_points
  if (typeof body.answer_key !== "undefined") updatePayload.answer_key = body.answer_key || null
  if (typeof body.explanation !== "undefined") updatePayload.explanation = body.explanation || null
  if (typeof body.scenario_tag !== "undefined") updatePayload.scenario_tag = body.scenario_tag || null
  if (typeof body.is_required === "boolean") updatePayload.is_required = body.is_required
  if (typeof body.sort_order === "number") updatePayload.sort_order = body.sort_order
  if (typeof body.options_json !== "undefined") updatePayload.options_json = body.options_json || null

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("activity_items")
    .update(updatePayload)
    .eq("id", itemId)
    .eq("activity_id", activityId)
    .select("id, prompt, item_type, max_points, answer_key, explanation, scenario_tag, is_required, options_json, sort_order")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
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

  const body = await request.json().catch(() => ({}))
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : ""

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 })
  }

  const { error } = await supabase.from("activity_items").delete().eq("id", itemId).eq("activity_id", activityId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
