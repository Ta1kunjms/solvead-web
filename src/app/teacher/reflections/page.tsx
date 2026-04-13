'use client'

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type ReflectionRow = {
  id: string
  student_id: string
  student_name: string
  student_lrn: string | null
  prompt_id: string
  prompt_text: string
  level_number: number | null
  level_title: string | null
  activity_title: string | null
  activity_type: string | null
  response_text: string
  teacher_feedback: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export default function TeacherReflectionsPage() {
  const [reflections, setReflections] = useState<ReflectionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed">("pending")
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const fetchReflections = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/teacher/reflections")
      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to load reflections")
        return
      }

      const body = await response.json()
      setReflections(body.reflections || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchReflections()
  }, [])

  const filteredReflections = useMemo(() => {
    if (filter === "pending") {
      return reflections.filter((item) => item.reviewed_by === null)
    }
    if (filter === "reviewed") {
      return reflections.filter((item) => item.reviewed_by !== null)
    }
    return reflections
  }, [filter, reflections])

  const pendingCount = reflections.filter((item) => item.reviewed_by === null).length
  const reviewedCount = reflections.length - pendingCount

  const saveFeedback = async (reflectionId: string) => {
    setSavingId(reflectionId)
    try {
      const response = await fetch("/api/teacher/reflections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reflectionId,
          teacher_feedback: feedbackDrafts[reflectionId] || "",
          reviewed: true,
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to save feedback")
        return
      }

      setFeedbackDrafts((current) => ({ ...current, [reflectionId]: "" }))
      await fetchReflections()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div className="teacher-panel teacher-entrance p-6">
        <p className="teacher-eyebrow">Reflection Review</p>
        <h1 className="teacher-title mt-2">Review Student Reflections</h1>
        <p className="teacher-subtitle mt-2">Read responses, add teacher feedback, and clear the review queue.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/teacher" className="teacher-button-ghost">
            Back to Dashboard
          </Link>
          <button onClick={() => setFilter("pending")} className="teacher-filter" data-active={filter === "pending"}>
            Pending ({pendingCount})
          </button>
          <button onClick={() => setFilter("reviewed")} className="teacher-filter" data-active={filter === "reviewed"}>
            Reviewed ({reviewedCount})
          </button>
          <button onClick={() => setFilter("all")} className="teacher-filter" data-active={filter === "all"}>
            All ({reflections.length})
          </button>
        </div>
      </div>

      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="teacher-card p-4">
          <p className="teacher-label">Total</p>
          <p className="teacher-metric mt-2">{reflections.length}</p>
          <p className="teacher-helper mt-1">Responses collected</p>
        </article>
        <article className="teacher-card p-4">
          <p className="teacher-label">Pending</p>
          <p className="teacher-metric mt-2">{pendingCount}</p>
          <p className="teacher-helper mt-1">Awaiting review</p>
        </article>
        <article className="teacher-card p-4">
          <p className="teacher-label">Reviewed</p>
          <p className="teacher-metric mt-2">{reviewedCount}</p>
          <p className="teacher-helper mt-1">Feedback delivered</p>
        </article>
      </div>

      <div className="teacher-panel p-5 space-y-4">
        {isLoading ? (
          <p className="teacher-helper">Loading reflections...</p>
        ) : filteredReflections.length === 0 ? (
          <p className="teacher-helper">No reflections to show for this filter.</p>
        ) : (
          filteredReflections.map((item) => (
            <article key={item.id} className="teacher-row p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{item.student_name}</h2>
                  <p className="text-xs text-slate-500">LRN: {item.student_lrn || "N/A"}</p>
                  <p className="text-xs text-slate-500">
                    {item.level_number ? `Level ${item.level_number} - ${item.level_title || ""}` : "General reflection"}
                    {item.activity_title ? ` - ${item.activity_title}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">Submitted {new Date(item.created_at).toLocaleString()}</p>
                </div>
                <span
                  className={`teacher-status ${item.reviewed_by ? "teacher-status--success" : "teacher-status--pending"}`}
                >
                  {item.reviewed_by ? "Reviewed" : "Pending"}
                </span>
              </div>

              <div className="teacher-panel-soft p-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{item.response_text}</p>
              </div>

              <div className="space-y-2">
                <label className="teacher-label">Teacher Feedback</label>
                <textarea
                  value={feedbackDrafts[item.id] ?? item.teacher_feedback ?? ""}
                  onChange={(e) => setFeedbackDrafts((current) => ({ ...current, [item.id]: e.target.value }))}
                  placeholder="Add coaching, praise, or next-step guidance..."
                  className="teacher-textarea"
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {item.reviewed_by
                    ? `Reviewed on ${item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : "unknown date"}`
                    : "Not reviewed yet"}
                </p>
                <button
                  onClick={() => saveFeedback(item.id)}
                  disabled={savingId === item.id}
                  className="teacher-button"
                >
                  {savingId === item.id ? "Saving..." : item.reviewed_by ? "Update Feedback" : "Mark Reviewed"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
