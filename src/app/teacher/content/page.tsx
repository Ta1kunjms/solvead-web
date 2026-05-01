"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateLessonForm } from "../components/CreateLessonForm";
import { CreateActivityForm } from "../components/CreateActivityForm";

type Level = {
  id: string;
  level_number: number;
  title: string;
  announcement?: string | null;
  geometry_focus: string;
};

type Lesson = {
  id: string;
  title: string;
  is_published: boolean;
};

type Activity = {
  id: string;
  title: string;
  activity_type: string;
  is_published: boolean;
};

type LevelContent = {
  level: Level;
  lessons: Lesson[];
  activities: Activity[];
};

export default function TeacherContentPage() {
  const router = useRouter();
  const [content, setContent] = useState<LevelContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/teacher/content");
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.replace("/");
          return;
        }

        const body = await response.json().catch(() => ({}));
        setError(body.error || "Failed to load content");
        setContent([]);
        return;
      }

      const data = await response.json();
      setContent(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setContent([]);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const selectedLevelData = content.find((c) => c.level.id === selectedLevel);
  const [editingAnnouncement, setEditingAnnouncement] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const levelCount = content.length;
  const levelItems = [...content].sort((a, b) => a.level.level_number - b.level.level_number);
  const levelCountLabel = isLoading
    ? "Geometry Levels"
    : `${levelCount} Geometry ${levelCount === 1 ? "Level" : "Levels"}`;

  return (
    <section className="space-y-6">
      <div className="teacher-panel teacher-entrance p-6">
        <p className="teacher-eyebrow">Content Management</p>
        <h1 className="teacher-title mt-2">Manage Lessons and Activities</h1>
        <p className="teacher-subtitle mt-2">
          Create and publish lessons and activities for each geometry level.
        </p>
      </div>

      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="teacher-panel p-4 lg:col-span-1 space-y-3">
          <p className="teacher-label">{levelCountLabel}</p>

          {isLoading ? (
            <p className="teacher-helper">Loading levels...</p>
          ) : levelItems.length === 0 ? (
            <p className="teacher-helper">No levels yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {levelItems.map((item) => (
                <button
                  key={item.level.id}
                  type="button"
                  onClick={() => setSelectedLevel(item.level.id)}
                  data-active={selectedLevel === item.level.id}
                  className="teacher-option"
                  aria-label={`Level ${item.level.level_number}`}
                >
                  <span className="teacher-option-number">{item.level.level_number}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedLevelData ? (
            <>
              <article className="teacher-panel p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-slate-900">
                      Level {selectedLevelData.level.level_number}
                    </h2>
                    <div className="mt-2">
                      <input
                        type="text"
                        className="w-full rounded border px-3 py-2 text-sm mt-1"
                        value={editingTitle ?? selectedLevelData.level.title}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="Level title"
                      />
                    </div>
                    <div className="mt-3">
                      <textarea
                        className="w-full rounded border px-3 py-2 text-sm"
                        value={editingAnnouncement ?? (selectedLevelData.level.announcement ?? "")}
                        onChange={(e) => setEditingAnnouncement(e.target.value)}
                        placeholder="Announcement / note / reminder for students"
                        rows={3}
                      />
                    </div>
                    <p className="teacher-helper mt-2">
                      {selectedLevelData.lessons.length} lessons, {selectedLevelData.activities.length} activities
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <button
                      onClick={async () => {
                        const id = selectedLevelData.level.id;
                        const announcement = editingAnnouncement ?? selectedLevelData.level.announcement ?? "";
                        const title = editingTitle ?? selectedLevelData.level.title;
                        try {
                          const res = await fetch(`/api/teacher/levels/${id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ announcement, title }),
                          });
                          if (!res.ok) {
                            const errorText = await res.text();
                            throw new Error(errorText);
                          }
                          setEditingAnnouncement(null);
                          setEditingTitle(null);
                          await fetchContent();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err));
                        }
                      }}
                      className="teacher-button"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </article>

              <article className="teacher-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Lessons ({selectedLevelData.lessons.length})
                  </h3>
                  <button onClick={() => setShowLessonForm(true)} className="teacher-button">
                    Create Lesson
                  </button>
                </div>

                {selectedLevelData.lessons.length === 0 ? (
                  <p className="teacher-helper">No lessons yet. Use Create Lesson to add one or more.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedLevelData.lessons.map((lesson) => (
                      <div key={lesson.id} className="teacher-row px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{lesson.title}</p>
                            <span
                              className={`teacher-status ${lesson.is_published ? "teacher-status--success" : "teacher-status--muted"}`}
                            >
                              {lesson.is_published ? "Published" : "Draft"}
                            </span>
                          </div>
                          <Link href={`/teacher/content/lessons/${lesson.id}`} className="teacher-button-ghost">
                            Edit
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="teacher-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Activities ({selectedLevelData.activities.length})
                  </h3>
                  <button onClick={() => setShowActivityForm(true)} className="teacher-button">
                    Create Activity
                  </button>
                </div>

                {selectedLevelData.activities.length === 0 ? (
                  <p className="teacher-helper">No activities yet. Use Create Activity to add one or more.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedLevelData.activities.map((activity) => (
                      <div key={activity.id} className="teacher-row px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                            <span
                              className={`teacher-status ${activity.is_published ? "teacher-status--success" : "teacher-status--muted"}`}
                            >
                              {activity.is_published ? "Published" : "Draft"}
                            </span>
                          </div>
                          <Link href={`/teacher/content/activities/${activity.id}`} className="teacher-button-ghost">
                            Edit
                          </Link>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{activity.activity_type}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </>
          ) : (
            <p className="teacher-helper text-center">Select a level to manage content.</p>
          )}
        </div>
      </div>

      {showLessonForm && selectedLevelData && (
        <CreateLessonForm
          levelId={selectedLevelData.level.id}
          levelNumber={selectedLevelData.level.level_number}
          onClose={() => setShowLessonForm(false)}
          onSaved={() => {
            void fetchContent();
          }}
        />
      )}

      {showActivityForm && selectedLevelData && (
        <CreateActivityForm
          levelId={selectedLevelData.level.id}
          levelNumber={selectedLevelData.level.level_number}
          onClose={() => setShowActivityForm(false)}
          onSaved={() => {
            void fetchContent();
          }}
        />
      )}
    </section>
  );
}
