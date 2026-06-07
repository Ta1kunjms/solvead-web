import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LevelsCompletedGraph } from "./components/LevelsCompletedGraph";
import { LeaderboardWidget } from "./components/LeaderboardWidget";

type TeacherProfile = {
  first_name: string;
  last_name: string;
};

type ClassSummary = {
  class_id: string;
  class_name: string;
  section: string | null;
  student_count: number;
  average_best_score: number;
  last_progress_at: string | null;
};

type ReflectionQueueItem = {
  id: string;
  reviewed_by: string | null;
};

type StudentDirectoryEntry = {
  student_id: string;
  first_name: string;
  last_name: string;
  lrn: string | null;
  profile_icon: string | null;
  onboarding_complete: boolean;
  created_at: string;
};

export default async function TeacherDashboardPage() {
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

  const [
    { data: roleRecord },
    { data: teacherProfile },
    { data: classSummaries },
    { data: reflectionQueue },
    { data: studentDirectory, error: studentDirectoryError },
  ] = await Promise.all([
    supabase.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("teacher_profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("teacher_class_progress_summary")
      .select("class_id, class_name, section, student_count, average_best_score, last_progress_at"),
    supabase.from("teacher_reflection_queue").select("id, reviewed_by"),
    supabase.rpc("teacher_visible_students"),
  ]);

  if (roleRecord?.role !== "teacher") {
    redirect("/student");
  }

  const profile = teacherProfile as TeacherProfile | null;
  const classes = (classSummaries ?? []) as ClassSummary[];
  const classItemsForGraph = classes.map((c) => ({ id: c.class_id, name: c.class_name }));
  const queue = (reflectionQueue ?? []) as ReflectionQueueItem[];
  const students = ((studentDirectory ?? []) as StudentDirectoryEntry[]).filter(Boolean);
  const studentDirectoryErrorMessage = studentDirectoryError
    ? `Unable to load student directory: ${studentDirectoryError.message || "Unknown error"}.`
    : null;
  const unreadReflections = queue.filter((item) => item.reviewed_by === null).length;
  const totalStudents = students.length;

  return (
    <section className="space-y-6">
      <div className="teacher-panel teacher-entrance p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="teacher-eyebrow">Teacher Dashboard</p>
            <h1 className="teacher-title mt-2">
              Welcome, {profile ? `${profile.first_name} ${profile.last_name}` : "Teacher"}
            </h1>
            <p className="teacher-subtitle mt-2">
              Monitor class progress, review reflections, and manage lesson and activity delivery.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/teacher/student-management" className="teacher-button">
            Student Management
          </Link>
          <Link href="/teacher/content" className="teacher-button-secondary">
            Content Studio
          </Link>
          <Link href="/teacher/reflections" className="teacher-button-ghost">
            Review Reflections
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6 min-w-0">
          <div className="grid gap-4 md:grid-cols-3">
            <article className="teacher-card p-4 teacher-stagger" style={{ animationDelay: "0.05s" }}>
              <p className="teacher-label">Classes</p>
              <p className="teacher-metric mt-2">{classes.length}</p>
              <p className="teacher-helper mt-1">Active sections and groups</p>
            </article>
            <article className="teacher-card p-4 teacher-stagger" style={{ animationDelay: "0.1s" }}>
              <p className="teacher-label">Total Students</p>
              <p className="teacher-metric mt-2">{totalStudents}</p>
              <p className="teacher-helper mt-1">Signed-in learners</p>
            </article>
            <article className="teacher-card p-4 teacher-stagger" style={{ animationDelay: "0.15s" }}>
              <p className="teacher-label">Reflection Queue</p>
              <p className="teacher-metric mt-2">{unreadReflections}</p>
              <p className="teacher-helper mt-1">Awaiting teacher feedback</p>
            </article>
          </div>

          <div className="teacher-panel p-5">
            <LevelsCompletedGraph initialClasses={classItemsForGraph} />
          </div>

          <div className="teacher-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Student Management Snapshot</h2>
              <Link href="/teacher/student-management" className="teacher-button-ghost">
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-3">
              {classes.length === 0 ? (
                <p className="teacher-helper">No classes found yet. Create your first class to begin monitoring.</p>
              ) : (
                classes.map((row) => (
                  <article key={row.class_id} className="teacher-row p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {row.class_name}
                          {row.section ? ` - ${row.section}` : ""}
                        </h3>
                        <p className="teacher-helper mt-1">Average score: {Number(row.average_best_score).toFixed(2)}%</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Last progress update: {row.last_progress_at ? new Date(row.last_progress_at).toLocaleString() : "No updates yet"}
                        </p>
                      </div>
                      <span className="teacher-chip">{row.student_count} students</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="teacher-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">All Students</h2>
              <span className="teacher-chip">{totalStudents} students</span>
            </div>
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
              {studentDirectoryErrorMessage ? (
                <p className="teacher-alert teacher-alert--error">{studentDirectoryErrorMessage}</p>
              ) : students.length === 0 ? (
                <p className="teacher-helper">No students yet. Students appear after signing in.</p>
              ) : (
                students.map((student) => (
                  <article key={student.student_id} className="teacher-row p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {student.first_name} {student.last_name}
                        </h3>
                        <p className="text-xs text-slate-500">LRN: {student.lrn || "N/A"}</p>
                      </div>
                      <span className="teacher-chip">{student.onboarding_complete ? "Onboarded" : "Pending"}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <LeaderboardWidget />
        </aside>
      </div>
    </section>
  );
}
