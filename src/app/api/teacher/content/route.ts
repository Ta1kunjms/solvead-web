import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data: levels, error: levelsError } = await supabase
    .from("levels")
    .select("id, level_number, title, geometry_focus, announcement")
    .order("level_number", { ascending: true });

  if (levelsError) {
    return NextResponse.json({ error: levelsError.message }, { status: 500 });
  }

  const result = [];

  for (const level of levels ?? []) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, title, is_published")
      .eq("level_id", level.id)
      .order("sort_order", { ascending: true });

    if (lessonsError) {
      return NextResponse.json({ error: lessonsError.message }, { status: 500 });
    }

    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("id, title, activity_type, is_published")
      .eq("level_id", level.id)
      .order("sort_order", { ascending: true });

    if (activitiesError) {
      return NextResponse.json({ error: activitiesError.message }, { status: 500 });
    }

    result.push({
      level,
      lessons: lessons || [],
      activities: activities || [],
    });
  }

  return NextResponse.json(result);
}
