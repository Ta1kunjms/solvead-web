import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PREFERENCES, normalizePreferencesRow, type UserPreferences } from "@/lib/preferences";

export async function getUserPreferencesForServer(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPreferences> {
  const { data } = await supabase
    .from("user_preferences")
    .select(
      "language, font_size, contrast_mode, dark_mode, sound_enabled, volume_level, brightness_level, sfx_level",
    )
    .eq("user_id", userId)
    .maybeSingle();

  return normalizePreferencesRow(data ?? DEFAULT_PREFERENCES);
}
