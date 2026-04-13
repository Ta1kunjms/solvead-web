import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type CreateActivityPayload = {
  level_id: string;
  title: string;
  instructions?: string;
  activity_type: "quiz" | "problem_solving" | "reflection" | "mixed";
  passing_score: number;
  sort_order?: number;
  is_required: boolean;
  is_published: boolean;
};

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleRecord } = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleRecord?.role !== "teacher") {
    return NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 });
  }

  const payload: CreateActivityPayload = await request.json();
  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (!payload.level_id || !title) {
    return NextResponse.json({ error: "Missing required fields: level_id, title" }, { status: 400 });
  }

  const passingScore = Number.isFinite(payload.passing_score)
    ? Math.max(0, Math.min(100, Math.floor(payload.passing_score)))
    : 70;

  const buildInsert = (sortOrder: number) =>
    supabase
      .from("activities")
      .insert({
        level_id: payload.level_id,
        title,
        instructions: payload.instructions?.trim() || null,
        activity_type: payload.activity_type || "quiz",
        passing_score: passingScore,
        is_required: payload.is_required ?? true,
        is_published: payload.is_published ?? false,
        created_by: user.id,
        sort_order: sortOrder,
      })
      .select("id");

  const requestedSortOrder = Number.isFinite(payload.sort_order)
    ? Math.max(1, Math.floor(payload.sort_order ?? 0))
    : null;

  let data;
  let error;

  if (requestedSortOrder) {
    ({ data, error } = await buildInsert(requestedSortOrder));
  } else {
    const { data: latestSort, error: latestSortError } = await supabase
      .from("activities")
      .select("sort_order")
      .eq("level_id", payload.level_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSortError) {
      return NextResponse.json({ error: latestSortError.message }, { status: 500 });
    }

    let nextSortOrder = (latestSort?.sort_order ?? 0) + 1;
    ({ data, error } = await buildInsert(nextSortOrder));

    if (error?.code === "23505") {
      const { data: retryLatestSort, error: retryLatestSortError } = await supabase
        .from("activities")
        .select("sort_order")
        .eq("level_id", payload.level_id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (retryLatestSortError) {
        return NextResponse.json({ error: retryLatestSortError.message }, { status: 500 });
      }

      nextSortOrder = (retryLatestSort?.sort_order ?? 0) + 1;
      ({ data, error } = await buildInsert(nextSortOrder));
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.[0]?.id, success: true }, { status: 201 });
}
