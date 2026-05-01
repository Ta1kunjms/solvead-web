import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCopy } from "@/lib/i18n";
import { getBrightnessMultiplier, getBaseFontSizeClass } from "@/lib/preferences";
import { getUserPreferencesForServer } from "@/lib/preferences-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LevelEntryCards } from "../../components/ActivityPlayer";

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
      .select("id, levels!inner(level_number)")
      .eq("levels.level_number", levelNumber)
      .eq("is_published", true),
    supabase
      .from("activities")
      .select("id, title, instructions, html_url, activity_type, levels!inner(level_number)")
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
  const lessonCount = (lessons ?? []).length;
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
    <main className={`relative min-h-screen overflow-hidden text-white ${baseFontSizeClass}`}>
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={backgroundStyle} />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45"
        aria-hidden="true"
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-6 md:px-10">
        <div className="flex w-full max-w-6xl flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/80">Level {levelRow.level_number}</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white drop-shadow md:text-4xl">{levelRow.title}</h1>
          </div>
          <Link
            href="/"
            className="control-button inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-950 md:text-sm"
          >
            {copy.backToMap}
          </Link>
        </div>

        <LevelEntryCards
          levelNumber={levelNumber}
          lessonCount={lessonCount}
          activityList={activityList}
          copy={copy}
        />
        {/* Bottom-left announcement only */}
        {levelRow.announcement ? (
          <div className="pointer-events-none fixed left-6 bottom-6 z-30 max-w-sm">
            <div className="bg-slate-900/80 text-white rounded-lg p-4 shadow-lg">
              <p className="text-sm text-amber-100">{levelRow.announcement}</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
