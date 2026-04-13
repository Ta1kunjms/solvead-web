import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HtmlActivityFrame } from "@/app/components/HtmlActivityFrame";
import { getCopy } from "@/lib/i18n";
import { getBaseFontSizeClass, getBrightnessMultiplier } from "@/lib/preferences";
import { getUserPreferencesForServer } from "@/lib/preferences-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ActivityPlayerWrapper } from "../../../components/ActivityPlayerWrapper";

type ActivityRecord = {
  id: string;
  title: string;
  instructions: string | null;
  html_url: string | null;
  activity_type: string;
  is_required: boolean;
};

type ActivityItemRecord = {
  id: string;
  prompt: string;
  item_type: "multiple_choice" | "short_answer" | "true_false" | "reflection";
  options_json: {
    choices?: string[];
  } | null;
  is_required: boolean;
};

type Params = {
  levelNumber: string;
};

export default async function StudentActivityPage({ params }: { params: Promise<Params> }) {
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

  const preferences = await getUserPreferencesForServer(supabase, user.id);
  const copy = getCopy(preferences.language);
  const baseFontSizeClass = getBaseFontSizeClass(preferences.font_size);
  const brightnessMultiplier = getBrightnessMultiplier(preferences.brightness_level);

  const { data: activities } = await supabase
    .from("activities")
    .select("id, title, instructions, html_url, activity_type, is_required, levels!inner(level_number)")
    .eq("levels.level_number", levelNumber)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const activityList = (activities ?? []) as ActivityRecord[];

  const activityItemsByActivity = new Map<string, ActivityItemRecord[]>();
  if (activityList.length > 0) {
    const { data: allItems } = await supabase
      .from("activity_items")
      .select("id, activity_id, prompt, item_type, options_json, is_required")
      .in(
        "activity_id",
        activityList.map((a) => a.id),
      )
      .order("sort_order", { ascending: true });

    for (const item of allItems ?? []) {
      const list = activityItemsByActivity.get(item.activity_id) || [];
      list.push({
        id: item.id,
        prompt: item.prompt,
        item_type: item.item_type as ActivityItemRecord["item_type"],
        options_json: item.options_json,
        is_required: item.is_required,
      });
      activityItemsByActivity.set(item.activity_id, list);
    }
  }

  return (
    <main
      className={`min-h-screen px-6 py-10 text-white ${baseFontSizeClass}`}
      style={{
        backgroundColor: preferences.dark_mode ? "#020617" : "#0f172a",
        filter: `brightness(${brightnessMultiplier})`,
      }}
    >
      <section className="mx-auto max-w-5xl rounded-2xl border border-teal-400/30 bg-slate-900/70 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-teal-300">Level {levelNumber} {copy.levelActivities}</p>
        <h1 className="mt-2 text-3xl font-bold text-teal-100">{copy.requiredMissions}</h1>
        <p className="mt-2 text-teal-50/90">{copy.completeRequiredActivities}</p>

        <div className="mt-6 space-y-3">
          {activityList.length === 0 ? (
            <article className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 text-zinc-200">
              {copy.noPublishedActivities}
            </article>
          ) : (
            <>
              {activityList.map((activity, index) => {
                const items = activityItemsByActivity.get(activity.id) || [];
                return (
                  <section key={activity.id} id={`activity-${activity.id}`} className="space-y-3">
                    <div className="rounded-xl border border-teal-300/30 bg-teal-400/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold text-white">
                          {index + 1}. {activity.title}
                        </h2>
                        <span className="rounded-full border border-teal-300/40 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-teal-100">
                          {activity.activity_type}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-teal-50/90">{activity.instructions ?? "No instructions provided."}</p>
                      <p className="mt-2 text-xs text-teal-200/90">
                        {activity.is_required ? "Required for level unlock" : "Optional"}
                      </p>
                    </div>
                    {activity.html_url && (
                      <div className="rounded-xl border border-teal-300/30 bg-white/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-teal-100">HTML Activity Content</p>
                          <Link
                            href={activity.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-teal-200 underline"
                          >
                            Open in new tab
                          </Link>
                        </div>
                        <HtmlActivityFrame
                          htmlUrl={activity.html_url}
                          title={`Activity HTML ${activity.title}`}
                          className="mt-3 h-[420px] w-full rounded-lg border border-teal-300/30 bg-white"
                          sandbox="allow-scripts"
                        />
                      </div>
                    )}
                    {items.length > 0 && (
                      <ActivityPlayerWrapper
                        levelNumber={levelNumber}
                        activityId={activity.id}
                        items={items}
                      />
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/student/levels/${levelNumber}`}
            className="inline-flex rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {copy.backToLevel}
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-teal-300/40 bg-teal-400/10 px-4 py-2 text-sm font-semibold text-teal-100 transition hover:bg-teal-400/20"
          >
            {copy.returnToMap}
          </Link>
        </div>
      </section>
    </main>
  );
}
