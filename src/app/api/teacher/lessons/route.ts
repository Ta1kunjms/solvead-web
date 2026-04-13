import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type CreateLessonPayload = {
  level_id: string;
  title: string;
  summary?: string;
  content_markdown?: string;
  ppt_url?: string;
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

  const payload: CreateLessonPayload = await request.json();
  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (!payload.level_id || !title) {
    return NextResponse.json({ error: "Missing required fields: level_id, title" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lessons")
    .insert({
      level_id: payload.level_id,
      title,
      summary: payload.summary?.trim() || null,
      content_markdown: payload.content_markdown?.trim() || null,
      ppt_url: payload.ppt_url?.trim() || null,
      is_published: payload.is_published ?? false,
      created_by: user.id,
      sort_order: 1,
    })
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.[0]?.id, success: true }, { status: 201 });
}
