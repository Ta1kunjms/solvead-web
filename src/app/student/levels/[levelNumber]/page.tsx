import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCopy } from "@/lib/i18n";
import { getBrightnessMultiplier, getBaseFontSizeClass } from "@/lib/preferences";
import { getUserPreferencesForServer } from "@/lib/preferences-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LevelEntryCards } from "../../components/ActivityPlayer";
import { LevelPageClient } from "../../components/LevelPageClient";

type LevelRecord = {
  id: string;
  level_number: number;
  title: string;
  geometry_focus: string;
  announcement?: string | null;
};

type ActivitySummary = {
  id: string;
  title: string | null;
  instructions: string | null;
  html_url: string | null;
  activity_type: string | null;
  output_type: string | null;
  button_label: string | null;
};

type ProgressRecord = {
  unlocked: boolean;
  completed: boolean;
  approval_status: string | null;
};

type Params = {
  levelNumber: string;
};

export default async function StudentLevelEntryPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const levelNumber = Number(resolved.levelNumber);

  if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 15) {
    notFound();
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    redirect("/");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const [{ data: level }, { data: progress }, { data: lessons }, { data: activities }] = await Promise.all([
    supabase
      .from("levels")
      .select("id, level_number, title, geometry_focus, announcement")
      .eq("level_number", levelNumber)
      .maybeSingle(),
    supabase
      .from("level_progress")
      .select("unlocked, completed, approval_status")
      .eq("user_id", user.id)
      .eq("level_number", levelNumber)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("id, ppt_url, sort_order, levels!inner(level_number)")
      .eq("levels.level_number", levelNumber)
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("activities")
      .select("id, title, instructions, html_url, activity_type, output_type, button_label, levels!inner(level_number)")
      .eq("levels.level_number", levelNumber)
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (!level) {
    notFound();
  }

  const levelRow = level as LevelRecord;
  const progressRow = progress as ProgressRecord | null;
  const isUnlocked = progressRow?.unlocked ?? levelNumber === 1;
  const isApproved = progressRow?.approval_status !== "pending" && progressRow?.approval_status !== "denied";
  const unlocked = isUnlocked && isApproved;
  const lessonList = (lessons ?? []) as { id: string; ppt_url: string | null }[];
  const lessonCount = lessonList.length;
  const lessonResourceUrl = lessonList.find((lesson) => lesson.ppt_url)?.ppt_url ?? null;
  const activityList = (activities ?? []) as ActivitySummary[];

  if (!unlocked) {
    redirect("/");
  }

  const preferences = await getUserPreferencesForServer(supabase, user.id);
  const copy = getCopy(preferences.language);
  const baseFontSizeClass = getBaseFontSizeClass(preferences.font_size);
  const brightnessMultiplier = getBrightnessMultiplier(preferences.brightness_level);

  const backgroundStyle = {
    backgroundImage: preferences.dark_mode
      ? "url('/assets/backgrounds/homepage-darkmode.png')"
      : "url('/assets/backgrounds/level-background.png')",
    filter: `brightness(${brightnessMultiplier})`,
  };

  return (
    <LevelPageClient
      levelNumber={levelNumber}
      levelTitle={levelRow.title}
      lessonCount={lessonCount}
      lessonResourceUrl={lessonResourceUrl}
      activityList={activityList}
      copy={copy}
      backgroundStyle={backgroundStyle}
      baseFontSizeClass={baseFontSizeClass}
      announcement={levelRow.announcement}
    />
  );
}
