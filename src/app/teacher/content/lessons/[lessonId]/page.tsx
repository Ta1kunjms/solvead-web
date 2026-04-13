import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LessonEditorPanel } from "../../../components/LessonEditorPanel";

type Params = {
  lessonId: string;
};

export default async function EditLessonPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const { lessonId } = resolved;

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

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, summary, content_markdown, ppt_url, is_published, sort_order, level_id, levels!inner(level_number, title)")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) {
    notFound();
  }

  const levelRelation = Array.isArray(lesson.levels) ? lesson.levels[0] : lesson.levels;
  const levelNumber = levelRelation?.level_number || 0;
  const levelTitle = levelRelation?.title || "";

  return (
    <section className="space-y-6">
      <div className="teacher-panel teacher-entrance p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="teacher-eyebrow">Edit Lesson</p>
            <h1 className="teacher-title mt-2">{lesson.title}</h1>
            <p className="teacher-subtitle mt-1">Level {levelNumber}: {levelTitle}</p>
          </div>
          <Link href="/teacher/content" className="teacher-button-ghost">
            Back to Content
          </Link>
        </div>
      </div>

      <LessonEditorPanel
        lesson={lesson as never}
        levelNumber={levelNumber}
        levelTitle={levelTitle}
      />
    </section>
  );
}
