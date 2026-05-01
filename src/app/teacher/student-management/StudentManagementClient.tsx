'use client'

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type TeacherClass = {
  id: string
  class_name: string
  section: string | null
  grade_level: string | null
  archived: boolean
  student_count: number
  average_best_score: number
  last_progress_at: string | null
  created_at: string
}

type TeacherStudent = {
  student_id: string
  first_name: string
  last_name: string
  lrn: string | null
  profile_icon: string | null
  onboarding_complete: boolean
  created_at: string
}

type LevelProgressRecord = {
  level_number: number
  completed: boolean
  best_score: number | null
}

type AttemptRecord = {
  id: string
  activity_id: string
  activity_title: string
  submitted_at: string | null
  score: number | null
  max_score: number | null
  score_percent: number | null
  passed: boolean | null
  screenshot: {
    available: boolean
    mime_type: string | null
    size_bytes: number | null
    uploaded_at: string | null
  }
}

export default function StudentManagementClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [students, setStudents] = useState<TeacherStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [expandedProgress, setExpandedProgress] = useState<LevelProgressRecord[]>([])
  const [expandedAttempts, setExpandedAttempts] = useState<AttemptRecord[]>([])
  const [expandProgressLoading, setExpandProgressLoading] = useState(false)
  const [previewAttemptId, setPreviewAttemptId] = useState<string | null>(null)
  const refreshTimerRef = useRef<number | null>(null)

  const fetchOverview = useCallback(async () => {
    setIsLoading(true)
    try {
      const [classesResponse, studentsResponse] = await Promise.all([
        fetch("/api/teacher/classes"),
        fetch("/api/teacher/students"),
      ])

      if (!classesResponse.ok) {
        const data = await classesResponse.json()
        throw new Error(data.error || "Failed to load classes")
      }

      if (!studentsResponse.ok) {
        const data = await studentsResponse.json()
        throw new Error(data.error || "Failed to load students")
      }

      const classesData = await classesResponse.json()
      const studentsData = await studentsResponse.json()

      setClasses(classesData.classes || [])
      setStudents(studentsData.students || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOverview()
  }, [fetchOverview])

  const toggleStudentExpansion = async (studentId: string) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null)
      setExpandedProgress([])
      setExpandedAttempts([])
      return
    }

    setExpandedStudentId(studentId)
    setExpandProgressLoading(true)
    try {
      const response = await fetch(`/api/teacher/students/${studentId}/progress`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to load student progress")
      }

      const data = await response.json()
      setExpandedProgress(data.progress || [])
      setExpandedAttempts(data.attempts || [])
    } catch (err) {
      console.error("Error fetching progress:", err)
      setExpandedProgress([])
      setExpandedAttempts([])
    } finally {
      setExpandProgressLoading(false)
    }
  }

  const openScreenshotPreview = async (studentId: string, attemptId: string) => {
    setPreviewAttemptId(attemptId)
    try {
      const response = await fetch(`/api/teacher/students/${studentId}/attempts/${attemptId}/screenshot`)
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body.error || "Failed to load screenshot preview")
      }

      if (typeof body.preview_url === "string" && body.preview_url) {
        window.open(body.preview_url, "_blank", "noopener,noreferrer")
      }
    } catch (err) {
      console.error("Error loading screenshot preview:", err)
    } finally {
      setPreviewAttemptId(null)
    }
  }

  useEffect(() => {
    void fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    if (!supabase) {
      return
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) {
        return
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void fetchOverview()
      }, 750)
    }

    const channel = supabase
      .channel("teacher-management-progress")
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_attempts" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "level_progress" }, scheduleRefresh)
      .subscribe()

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }

      void supabase.removeChannel(channel)
    }
  }, [fetchOverview, supabase])

  return (
    <section className="space-y-6">
      <div className="teacher-panel teacher-entrance p-6">
        <p className="teacher-eyebrow">Student Management</p>
        <h1 className="teacher-title mt-2">Manage Students</h1>
        <p className="teacher-subtitle mt-2">
          Review every visible student in row form, then jump into a class when you need to make roster changes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/teacher" className="teacher-button-ghost">
            Back to Dashboard
          </Link>
        </div>
      </div>

      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <div className="teacher-panel p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">All Students</h2>
          <span className="teacher-chip">{students.length} students</span>
        </div>
        {isLoading ? (
          <p className="teacher-helper">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="teacher-helper">No students are visible yet. They will appear here after logging in.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid md:grid-cols-[1.6fr_1fr_0.8fr] md:gap-4">
              <span>Name</span>
              <span>LRN</span>
              <span>Joined</span>
            </div>
            {students.map((student) => (
              <div key={student.student_id}>
                <article
                  className="teacher-row p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => toggleStudentExpansion(student.student_id)}
                >
                  <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_0.8fr] md:gap-4">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {student.first_name} {student.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700">{student.lrn || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700">{new Date(student.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </article>

                {expandedStudentId === student.student_id && (
                  <div className="bg-slate-50 border-l-4 border-slate-300 p-4 space-y-3">
                    {expandProgressLoading ? (
                      <p className="text-sm text-slate-500">Loading progress...</p>
                    ) : (
                      <div className="grid gap-4">
                        {expandedProgress.length === 0 ? (
                          <p className="text-sm text-slate-500">No level progress yet.</p>
                        ) : (
                          <div className="grid gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 mb-2">Level Progress</h4>
                            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                              {expandedProgress.map((prog) => (
                                <div
                                  key={prog.level_number}
                                  className="rounded-lg border border-slate-200 bg-white p-3 text-center"
                                >
                                  <p className="text-xs font-semibold text-slate-600">Level {prog.level_number}</p>
                                  <p className="text-xs mt-1">
                                    {prog.completed ? (
                                      <span className="text-green-700 font-semibold">Completed</span>
                                    ) : (
                                      <span className="text-slate-500">Not Done</span>
                                    )}
                                  </p>
                                  {prog.best_score !== null && (
                                    <p className="text-xs text-slate-600 mt-1">Score: {prog.best_score}%</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">Recent Activity Results</h4>
                          {expandedAttempts.length === 0 ? (
                            <p className="text-sm text-slate-500">No graded activity results yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {expandedAttempts.map((attempt) => (
                                <div key={attempt.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{attempt.activity_title}</p>
                                    <span className={`text-xs font-semibold ${attempt.passed ? "text-green-700" : "text-amber-700"}`}>
                                      {attempt.passed ? "Passed" : "Needs retry"}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span
                                      className={`rounded-full px-2 py-1 font-semibold ${
                                        attempt.screenshot.available ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {attempt.screenshot.available ? "Screenshot available" : "No screenshot"}
                                    </span>
                                    {attempt.screenshot.available ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void openScreenshotPreview(student.student_id, attempt.id)
                                        }}
                                        disabled={previewAttemptId === attempt.id}
                                        className="rounded-full border border-teal-300/40 bg-teal-400/10 px-2 py-1 font-semibold text-teal-700 transition hover:bg-teal-400/20 disabled:cursor-wait disabled:opacity-60"
                                      >
                                        {previewAttemptId === attempt.id ? "Opening..." : "View Screenshot"}
                                      </button>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">
                                    Score: {attempt.score_percent ?? "-"}%
                                    {typeof attempt.score === "number" && typeof attempt.max_score === "number"
                                      ? ` (${attempt.score}/${attempt.max_score})`
                                      : ""}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Submission time unavailable"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
