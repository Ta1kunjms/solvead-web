import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ActivityItemManager } from "../../../components/ActivityItemManager";
import { ActivityEditorPanel } from "../../../components/ActivityEditorPanel";

type Params = {
  activityId: string;
};

type ActivityItemRow = {
  id: string;
  prompt: string;
  item_type: "multiple_choice" | "short_answer" | "true_false" | "reflection";
  max_points: number;
  answer_key: string | null;
  explanation: string | null;
  scenario_tag: string | null;
  is_required: boolean;
  options_json: { choices?: string[] } | null;
  sort_order: number;
};

export default async function EditActivityPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const { activityId } = resolved;

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

  const { data: roleRecord } = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleRecord?.role !== "teacher") {
    redirect("/teacher");
  }

  const { data: activity } = await supabase
    .from("activities")
    .select("id, title, instructions, html_url, activity_type, passing_score, is_published, is_required, sort_order, level_id, levels!inner(level_number, title)")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity) {
    notFound();
  }

  const { data: items } = await supabase
    .from("activity_items")
    .select("id, prompt, item_type, max_points, answer_key, explanation, scenario_tag, is_required, options_json, sort_order")
    .eq("activity_id", activityId)
    .order("sort_order", { ascending: true });

  const levelRelation = Array.isArray(activity.levels) ? activity.levels[0] : activity.levels;
  const levelNumber = levelRelation?.level_number || 0;
  const levelTitle = levelRelation?.title || "";

  return (
    <section className="space-y-6">
      <div className="teacher-panel teacher-entrance p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="teacher-eyebrow">Edit Activity</p>
            <h1 className="teacher-title mt-2">{activity.title}</h1>
            <p className="teacher-subtitle mt-1">Level {levelNumber}: {levelTitle}</p>
          </div>
          <Link href="/teacher/content" className="teacher-button-ghost">
            Back to Content
          </Link>
        </div>
      </div>

      <ActivityEditorPanel
        activity={activity as {
          id: string;
          level_id: string;
          title: string;
          instructions: string | null;
          html_url: string | null;
          activity_type: "quiz" | "problem_solving" | "reflection" | "mixed";
          passing_score: number;
          is_required: boolean;
          is_published: boolean;
          sort_order: number;
        }}
        levelNumber={levelNumber}
        levelTitle={levelTitle}
      />

      <ActivityItemManager activityId={activityId} initialItems={(items ?? []) as ActivityItemRow[]} />
    </section>
  );
}
