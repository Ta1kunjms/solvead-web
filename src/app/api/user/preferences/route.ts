import { NextRequest, NextResponse } from "next/server";
import { normalizePreferencesRow } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "language, font_size, contrast_mode, dark_mode, sound_enabled, volume_level, brightness_level, sfx_level",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: normalizePreferencesRow(data) });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const nextPreferences = normalizePreferencesRow(payload);

  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, ...nextPreferences }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: nextPreferences });
}
