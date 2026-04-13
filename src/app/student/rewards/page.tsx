import Link from "next/link"
import { redirect } from "next/navigation"
import { getCopy } from "@/lib/i18n"
import { getBaseFontSizeClass, getBrightnessMultiplier } from "@/lib/preferences"
import { getUserPreferencesForServer } from "@/lib/preferences-server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import RewardsDisplay from "../components/RewardsDisplay"

type RewardRecord = {
  points: number
  stars: number
  badges: string[]
}

type ProgressRow = {
  level_number: number
  completed: boolean
  best_score: number | null
  updated_at: string
}

export default async function StudentRewardsPage() {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    redirect("/")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const preferences = await getUserPreferencesForServer(supabase, user.id)
  const copy = getCopy(preferences.language)
  const baseFontSizeClass = getBaseFontSizeClass(preferences.font_size)
  const brightnessMultiplier = getBrightnessMultiplier(preferences.brightness_level)

  const [{ data: rewards }, { data: progress }] = await Promise.all([
    supabase.from("user_rewards").select("points, stars, badges").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("level_progress")
      .select("level_number, completed, best_score, updated_at")
      .eq("user_id", user.id)
      .order("level_number", { ascending: true }),
  ])

  const rewardRecord = (rewards ?? { points: 0, stars: 0, badges: [] }) as RewardRecord
  const progressRows = (progress ?? []) as ProgressRow[]
  const completedLevels = progressRows.filter((row) => row.completed)
  const bestScoreAverage =
    completedLevels.length > 0
      ? Math.round(
          completedLevels.reduce((sum, row) => sum + (row.best_score ?? 0), 0) /
            completedLevels.length,
        )
      : 0

  const latestMilestones = [...completedLevels]
    .sort((a, b) => b.level_number - a.level_number)
    .slice(0, 5)

  return (
    <main
      className={`min-h-screen px-6 py-10 text-white ${baseFontSizeClass}`}
      style={{
        backgroundColor: preferences.dark_mode ? "#020617" : "#0f172a",
        filter: `brightness(${brightnessMultiplier})`,
      }}
    >
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(34,211,238,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">{copy.rewardCenter}</p>
              <h1 className="mt-2 text-3xl font-bold text-cyan-100">{copy.growthTracker}</h1>
              <p className="mt-2 text-cyan-50/80">
                Review your stars, points, badges, and recent milestones.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              {copy.backToMap}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">{copy.completedLevels}</p>
            <p className="mt-2 text-3xl font-bold text-cyan-100">{completedLevels.length}</p>
          </article>
          <article className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">{copy.avgBestScore}</p>
            <p className="mt-2 text-3xl font-bold text-cyan-100">{bestScoreAverage}%</p>
          </article>
          <article className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">{copy.recentMilestones}</p>
            <p className="mt-2 text-3xl font-bold text-cyan-100">{latestMilestones.length}</p>
          </article>
        </div>

        <article className="rounded-2xl border border-cyan-300/30 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-cyan-100">{copy.rewardsSummary}</h2>
          <div className="mt-4">
            <RewardsDisplay rewards={rewardRecord} />
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/30 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-cyan-100">{copy.latestCompletedLevels}</h2>
          {latestMilestones.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-300">{copy.noCompletedLevels}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {latestMilestones.map((row) => (
                <div key={row.level_number} className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2">
                  <p className="text-sm font-semibold text-cyan-100">Level {row.level_number} completed</p>
                  <p className="text-xs text-cyan-200/80">
                    Best score: {row.best_score ?? 0}% · Updated {new Date(row.updated_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  )
}
