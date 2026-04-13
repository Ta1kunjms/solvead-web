'use client'

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type ClassRecord = {
  id: string
  class_name: string
  section: string | null
  grade_level: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

type SummaryRecord = {
  class_id: string
  class_name: string
  section: string | null
  student_count: number
  average_best_score: number
  last_progress_at: string | null
}

type RosterRecord = {
  student_id: string
  enrolled_at: string
  is_active: boolean
  first_name: string | null
  last_name: string | null
  lrn: string | null
  completed_levels: number
  best_score: number | null
}

type ClassPayload = {
  class: ClassRecord
  summary: SummaryRecord | null
  roster: RosterRecord[]
  total_visible_students?: number | null
  total_visible_students_error?: string | null
}

export function ClassDetailPanel({ classId }: { classId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [data, setData] = useState<ClassPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addLrn, setAddLrn] = useState("")
  const rosterIdsRef = useRef<Set<string>>(new Set())
  const refreshTimerRef = useRef<number | null>(null)

  const [form, setForm] = useState({
    class_name: "",
    section: "",
    grade_level: "",
    archived: false,
  })

  const fetchClass = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/teacher/classes/${classId}`)
      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to load class")
        return
      }

      const payload: ClassPayload = await response.json()
      setData(payload)
      setForm({
        class_name: payload.class.class_name,
        section: payload.class.section || "",
        grade_level: payload.class.grade_level || "",
        archived: payload.class.archived,
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [classId])

  useEffect(() => {
    void fetchClass()
  }, [fetchClass])

  useEffect(() => {
    rosterIdsRef.current = new Set((data?.roster ?? []).map((student) => student.student_id))
  }, [data])

  useEffect(() => {
    if (!supabase) {
      return
    }

    const scheduleRefresh = (candidateId: string | null) => {
      if (!candidateId || !rosterIdsRef.current.has(candidateId)) {
        return
      }

      if (refreshTimerRef.current !== null) {
        return
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void fetchClass()
      }, 500)
    }

    const channel = supabase
      .channel(`teacher-class-progress-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_attempts" },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as { student_id?: string }
          scheduleRefresh(row.student_id ?? null)
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "level_progress" },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as { user_id?: string }
          scheduleRefresh(row.user_id ?? null)
        },
      )
      .subscribe()

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }

      void supabase.removeChannel(channel)
    }
  }, [classId, fetchClass, supabase])

  const roster = useMemo(() => data?.roster ?? [], [data])

  const saveClass = async () => {
    setSaving(true)
    setError(null)
    try {
      const className = form.class_name.trim()
      const section = form.section.trim()
      const gradeLevel = form.grade_level.trim()

      if (!className) {
        setError("Class name is required")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/teacher/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: className,
          section,
          grade_level: gradeLevel,
          archived: form.archived,
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to update class")
        return
      }

      await fetchClass()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const addStudent = async () => {
    const trimmedLrn = addLrn.trim()
    if (!trimmedLrn) {
      setError("Student LRN is required")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lrn: trimmedLrn }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to add student")
        return
      }

      setAddLrn("")
      await fetchClass()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const removeStudent = async (studentId: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to remove student")
        return
      }

      await fetchClass()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return <p className="text-zinc-400">Loading class details...</p>
  }

  if (!data) {
    return <p className="text-zinc-400">No class data found.</p>
  }

  return (
    <div className="space-y-6">
      <div className="teacher-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="teacher-eyebrow">Class Detail</p>
            <h1 className="teacher-title mt-2">{data.class.class_name}</h1>
            <p className="teacher-subtitle mt-1">
              {data.class.section ? `${data.class.section} - ` : ""}
              {data.class.grade_level || "No grade level set"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {typeof data.total_visible_students === "number" && (
              <span className="teacher-chip">All Students: {data.total_visible_students}</span>
            )}
            {data.total_visible_students_error && (
              <span className="teacher-status teacher-status--muted">Student total unavailable</span>
            )}
            {data.class.archived && <span className="teacher-status teacher-status--muted">Archived</span>}
            <Link href="/teacher/student-management?view=list" className="teacher-button-ghost">
              Back to Student Management
            </Link>
          </div>
        </div>
      </div>

      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="teacher-card p-4">
          <p className="teacher-label">Students</p>
          <p className="teacher-metric mt-2">{data.summary?.student_count ?? roster.length}</p>
          <p className="teacher-helper mt-1">Class roster</p>
        </article>
        <article className="teacher-card p-4">
          <p className="teacher-label">Average Best Score</p>
          <p className="teacher-metric mt-2">{Number(data.summary?.average_best_score ?? 0).toFixed(2)}%</p>
          <p className="teacher-helper mt-1">Across enrolled learners</p>
        </article>
        <article className="teacher-card p-4">
          <p className="teacher-label">Archived</p>
          <p className="teacher-metric mt-2">{data.class.archived ? "Yes" : "No"}</p>
          <p className="teacher-helper mt-1">Class visibility</p>
        </article>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <article className="teacher-panel p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Class Settings</h2>
            <button onClick={() => setForm({ ...form, archived: !form.archived })} className="teacher-button-ghost">
              {form.archived ? "Unarchive" : "Archive"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Class Name</label>
              <input
                type="text"
                value={form.class_name}
                onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                className="teacher-input"
              />
            </div>
            <div>
              <label className="teacher-label">Section</label>
              <input
                type="text"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                className="teacher-input"
              />
            </div>
          </div>

          <div>
            <label className="teacher-label">Grade Level</label>
            <input
              type="text"
              value={form.grade_level}
              onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
              className="teacher-input"
            />
          </div>

          <button onClick={saveClass} disabled={saving} className="teacher-button disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </article>

        <article className="teacher-panel p-5 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Add Student by LRN</h2>
          <div>
            <label className="teacher-label">Student LRN</label>
            <input
              type="text"
              value={addLrn}
              onChange={(e) => setAddLrn(e.target.value)}
              placeholder="Enter student LRN"
              className="teacher-input"
            />
          </div>
          <button
            onClick={addStudent}
            disabled={saving || !addLrn.trim()}
            className="teacher-button w-full disabled:opacity-50"
          >
            Add Student
          </button>

          <div className="teacher-panel-soft p-3 text-sm text-slate-600">
            Students can be assigned by LRN from their profile record.
          </div>
        </article>
      </section>

      <section className="teacher-panel p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Roster</h2>
          <span className="teacher-chip">{roster.length} students</span>
        </div>

        {roster.length === 0 ? (
          <p className="teacher-helper">No students assigned to this class yet.</p>
        ) : (
          <div className="space-y-2">
            {roster.map((student) => (
              <article key={student.student_id} className="teacher-row p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {student.first_name || "Student"} {student.last_name || ""}
                    </h3>
                    <p className="text-xs text-slate-500">LRN: {student.lrn || "N/A"}</p>
                    <p className="text-xs text-slate-500">
                      {student.completed_levels} completed levels, best score {student.best_score ?? 0}%
                    </p>
                  </div>
                  <button
                    onClick={() => removeStudent(student.student_id)}
                    disabled={saving}
                    className="teacher-button-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
