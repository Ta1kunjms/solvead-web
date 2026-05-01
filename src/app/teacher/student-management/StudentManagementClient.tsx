'use client'

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

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
  unlocked: boolean
  approval_status: string | null
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
  const [students, setStudents] = useState<TeacherStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [expandedProgress, setExpandedProgress] = useState<LevelProgressRecord[]>([])
  const [expandedAttempts, setExpandedAttempts] = useState<AttemptRecord[]>([])
  const [expandProgressLoading, setExpandProgressLoading] = useState(false)
  const [previewAttemptId, setPreviewAttemptId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveNote, setApproveNote] = useState("")
  const [pendingApproval, setPendingApproval] = useState<{ studentId: string; levelNumber: number } | null>(null)
  const refreshTimerRef = useRef<number | null>(null)

  const fetchOverview = useCallback(async () => {
    setIsLoading(true)
    try {
      const studentsResponse = await fetch("/api/teacher/students")

      if (!studentsResponse.ok) {
        const data = await studentsResponse.json()
        throw new Error(data.error || "Failed to load students")
      }

      const studentsData = await studentsResponse.json()
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
      const response = await fetch(`/api/teacher/level-approvals/${studentId}`)
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

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to permanently delete this student and all their data?")) {
      return
    }
    setSaving(studentId)
    try {
      const response = await fetch("/api/teacher/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete student")
      }
      setStudents((prev) => prev.filter((s) => s.student_id !== studentId))
      if (expandedStudentId === studentId) {
        setExpandedStudentId(null)
        setExpandedProgress([])
        setExpandedAttempts([])
      }
    } catch (err) {
      console.error("Error deleting student:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(null)
    }
  }

  const handleApproveLevel = async (studentId: string, levelNumber: number) => {
    setSaving(`${studentId}-${levelNumber}`)
    try {
      const response = await fetch(`/api/teacher/level-approvals/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level_number: levelNumber,
          approval_status: "approved",
          approval_note: approveNote || null,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to approve")
      }
      if (expandedStudentId === studentId) {
        setExpandedProgress((prev) =>
          prev.map((p) =>
            p.level_number === levelNumber
              ? { ...p, approval_status: "approved", unlocked: true }
              : p.level_number === levelNumber + 1
                ? { ...p, approval_status: "approved", unlocked: true }
                : p
          )
        )
      }
      setShowApproveModal(false)
      setApproveNote("")
      setPendingApproval(null)
    } catch (err) {
      console.error("Error approving level:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(null)
    }
  }

  const handleDenyLevel = async (studentId: string, levelNumber: number) => {
    setSaving(`${studentId}-${levelNumber}`)
    try {
      const response = await fetch(`/api/teacher/level-approvals/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level_number: levelNumber,
          approval_status: "denied",
          approval_note: approveNote || null,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to deny")
      }
      if (expandedStudentId === studentId) {
        setExpandedProgress((prev) =>
          prev.map((p) =>
            p.level_number === levelNumber
              ? { ...p, approval_status: "denied", unlocked: false }
              : p
          )
        )
      }
      setShowApproveModal(false)
      setApproveNote("")
      setPendingApproval(null)
    } catch (err) {
      console.error("Error denying level:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(null)
    }
  }

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }

  const handleBulkApprove = async () => {
    if (selectedStudents.size === 0) return
    setSaving("bulk-approve")
    try {
      const approvePromises = Array.from(selectedStudents).map(async (studentId) => {
        const pendingLevel = expandedProgress.find(
          (p) => p.approval_status === "pending" && p.completed
        )
        if (pendingLevel) {
          await fetch(`/api/teacher/level-approvals/${studentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level_number: pendingLevel.level_number,
              approval_status: "approved",
            }),
          })
        }
      })
      await Promise.all(approvePromises)
      setExpandedProgress((prev) =>
        prev.map((p) =>
          p.approval_status === "pending"
            ? { ...p, approval_status: "approved", unlocked: true }
            : p
        )
      )
      setSelectedStudents(new Set())
    } catch (err) {
      console.error("Error bulk approving:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(null)
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
          {selectedStudents.size > 0 && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={saving === "bulk-approve"}
              className="teacher-button text-sm"
            >
              {saving === "bulk-approve" ? "Approving..." : `Approve Selected (${selectedStudents.size})`}
            </button>
          )}
          <span className="teacher-chip">{students.length} students</span>
        </div>
        {isLoading ? (
          <p className="teacher-helper">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="teacher-helper">No students are visible yet. They will appear here after logging in.</p>
        ) : (
             <div className="space-y-2">
              <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid md:grid-cols-[auto_1.6fr_1fr_0.8fr] md:gap-4">
                <span className="w-8"></span>
                <span>Name</span>
                <span>LRN</span>
                <span>Joined</span>
              </div>
              {students.map((student) => (
                <div key={student.student_id}>
                  <article className="teacher-row p-4 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-3 md:grid md:grid-cols-[auto_1.6fr_1fr_0.8fr_auto] md:gap-4">
                      <div className="w-8 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.student_id)}
                          onChange={() => toggleStudentSelection(student.student_id)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </div>
                      <div
                        className="cursor-pointer hover:bg-slate-100 -m-4 p-4 rounded-xl transition-colors"
                        onClick={() => toggleStudentExpansion(student.student_id)}
                      >
                        <p className="text-base font-semibold text-slate-900">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="md:hidden text-sm text-slate-500 mt-1">
                          LRN: {student.lrn || "N/A"} · Joined: {new Date(student.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-sm text-slate-700">{student.lrn || "N/A"}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-sm text-slate-700">{new Date(student.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex justify-end gap-2 mt-2 md:mt-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const completedLevel = expandedProgress
                              .filter((p) => p.completed)
                              .sort((a, b) => b.level_number - a.level_number)[0]
                            const nextLevel = completedLevel 
                              ? completedLevel.level_number + 1 
                              : 1
                            setPendingApproval({
                              studentId: student.student_id,
                              levelNumber: nextLevel,
                            })
                            setShowApproveModal(true)
                          }}
                          disabled={expandedAttempts.length === 0 && !expandedProgress.some((p) => p.completed)}
                          className="teacher-button disabled:opacity-50 text-sm px-3 py-1.5"
                        >
                          Proceed
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteStudent(student.student_id)
                          }}
                          disabled={saving === student.student_id}
                          className="teacher-button-danger disabled:opacity-50 text-sm px-3 py-1.5"
                        >
                          {saving === student.student_id ? "Deleting..." : "Delete"}
                        </button>
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
                                  {prog.approval_status && prog.approval_status !== "approved" && (
                                    <p className={`text-xs mt-1 font-semibold ${
                                      prog.approval_status === "pending" ? "text-amber-700" : "text-red-700"
                                    }`}>
                                      {prog.approval_status === "pending" ? "Awaiting" : "Denied"}
                                    </p>
                                  )}
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

      {showApproveModal && pendingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Approve Level {pendingApproval.levelNumber}
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Approving will unlock Level {pendingApproval.levelNumber + 1} for this student.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Add a note (optional)
              </label>
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className="mt-1 block w-full rounded-lg border-slate-300 border p-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                rows={3}
                placeholder="Enter a note for the student..."
              />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false)
                  setPendingApproval(null)
                  setApproveNote("")
                }}
                className="teacher-button-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDenyLevel(
                    pendingApproval.studentId,
                    pendingApproval.levelNumber
                  )
                }
                disabled={saving === `${pendingApproval.studentId}-${pendingApproval.levelNumber}`}
                className="teacher-button-danger disabled:opacity-50"
              >
                Deny
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApproveLevel(
                    pendingApproval.studentId,
                    pendingApproval.levelNumber
                  )
                }
                disabled={saving === `${pendingApproval.studentId}-${pendingApproval.levelNumber}`}
                className="teacher-button disabled:opacity-50"
              >
                {saving === `${pendingApproval.studentId}-${pendingApproval.levelNumber}` ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
