'use client'

import { FormEvent, useCallback, useState } from "react"

type Props = {
  onClose: () => void
  onSaved?: () => void
}

export function CreateClassForm({ onClose, onSaved }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    class_name: "",
    section: "",
    grade_level: "",
  })

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const className = form.class_name.trim()
      const section = form.section.trim()
      const gradeLevel = form.grade_level.trim()

      if (!className) {
        setError("Class name is required")
        setIsSubmitting(false)
        return
      }

      const response = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: className,
          section,
          grade_level: gradeLevel,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create class")
        setIsSubmitting(false)
        return
      }

      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setIsSubmitting(false)
    }
  }, [form, onClose, onSaved])

  return (
    <div className="teacher-modal">
      <article className="teacher-modal-card p-6">
        <h2 className="text-2xl font-semibold text-slate-900">Create Class</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="teacher-label">Class Name</label>
            <input
              type="text"
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              placeholder="e.g., Grade 7 Geometry"
              className="teacher-input"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Section</label>
              <input
                type="text"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                placeholder="e.g., A"
                className="teacher-input"
              />
            </div>
            <div>
              <label className="teacher-label">Grade Level</label>
              <input
                type="text"
                value={form.grade_level}
                onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                placeholder="e.g., Grade 7"
                className="teacher-input"
              />
            </div>
          </div>

          {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="teacher-button-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="teacher-button flex-1 disabled:opacity-50">
              {isSubmitting ? "Creating..." : "Create Class"}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
