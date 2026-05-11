import { notFound, redirect } from "next/navigation";
import { getCopy } from "@/lib/i18n";
import { getBaseFontSizeClass, getBrightnessMultiplier } from "@/lib/preferences";
import { getUserPreferencesForServer } from "@/lib/preferences-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LessonPageClient } from "../../../components/LessonPageClient";

type LessonRecord = {
  id: string;
  title: string;
  summary: string | null;
  content_markdown: string | null;
  ppt_url: string | null;
};

type Params = {
  levelNumber: string;
};

export default async function StudentLessonPage({ params }: { params: Promise<Params> }) {
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

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, summary, content_markdown, ppt_url, levels!inner(level_number)")
    .eq("levels.level_number", levelNumber)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const lessonList = (lessons ?? []) as LessonRecord[];

  return (
    <LessonPageClient
      levelNumber={levelNumber}
      copy={copy}
      baseFontSizeClass={baseFontSizeClass}
      brightnessMultiplier={brightnessMultiplier}
      darkMode={preferences.dark_mode}
    >
      <section className="mx-auto max-w-4xl rounded-2xl border border-cyan-400/30 bg-slate-900/70 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Level {levelNumber} {copy.levelLesson}</p>
        <h1 className="mt-2 text-3xl font-bold text-cyan-100">{copy.levelLesson}</h1>

        <p className="mt-4 text-cyan-50/90">
          {lessonList.length > 0
            ? `This level has ${lessonList.length} published lesson${lessonList.length === 1 ? "" : "s"}.`
            : "Your teacher will publish lesson content for this level. You can proceed to activities based on teacher instructions."}
        </p>

        {lessonList.length === 0 ? (
          <article className="mt-5 rounded-xl border border-cyan-300/20 bg-slate-800/70 p-4 text-sm text-cyan-50/90">
            {copy.lessonComingSoon}
          </article>
        ) : (
          <div className="mt-5 space-y-4">
            {lessonList.map((lesson, index) => (
              <article key={lesson.id} className="rounded-xl border border-cyan-300/20 bg-slate-800/70 p-4">
                <h2 className="text-lg font-semibold text-cyan-100">
                  {index + 1}. {lesson.title}
                </h2>
                <p className="mt-2 text-sm text-cyan-50/90">
                  {lesson.summary ?? "No summary provided yet."}
                </p>
                {lesson.content_markdown ? (
                  <div className="mt-3 text-sm leading-7 text-cyan-50/90 whitespace-pre-wrap">
                    {lesson.content_markdown}
                  </div>
                ) : null}
                {lesson.ppt_url ? (
                  <a
                    href={lesson.ppt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    {copy.openPptResource}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </LessonPageClient>
  );
}
