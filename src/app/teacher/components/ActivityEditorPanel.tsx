'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HtmlActivityFrame } from "@/app/components/HtmlActivityFrame"

type Activity = {
  id: string
  level_id: string
  title: string
  instructions: string | null
  html_url: string | null
  activity_type: "quiz" | "problem_solving" | "reflection" | "mixed"
  passing_score: number
  is_required: boolean
  is_published: boolean
  sort_order: number
}

type Props = {
  activity: Activity
  levelNumber: number
  levelTitle: string
}

export function ActivityEditorPanel({ activity, levelNumber, levelTitle }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: activity.title,
    instructions: activity.instructions ?? "",
    activity_type: activity.activity_type,
    passing_score: activity.passing_score,
    is_required: activity.is_required,
    is_published: activity.is_published,
    sort_order: activity.sort_order,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [htmlUrl, setHtmlUrl] = useState<string | null>(activity.html_url ?? null)
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [isUploadingHtml, setIsUploadingHtml] = useState(false)
  const [htmlUploadError, setHtmlUploadError] = useState<string | null>(null)

  const saveActivity = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/teacher/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to save activity")
        return
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const deleteActivity = async () => {
    if (!window.confirm("Delete this activity and all its items? This cannot be undone.")) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/teacher/activities/${activity.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to delete activity")
        return
      }

      router.push("/teacher/content")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const uploadHtml = async () => {
    if (!htmlFile) {
      setHtmlUploadError("Select an HTML file to upload")
      return
    }

    setIsUploadingHtml(true)
    setHtmlUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", htmlFile)

      const response = await fetch(`/api/teacher/activities/${activity.id}/html`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setHtmlUploadError(body.error || `Upload failed (HTTP ${response.status})`)
        return
      }

      const body = await response.json()
      setHtmlUrl(body.html_url || null)
      setHtmlFile(null)
    } catch (err) {
      setHtmlUploadError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsUploadingHtml(false)
    }
  }

  const removeHtml = async () => {
    if (!htmlUrl) {
      return
    }

    if (!window.confirm("Remove the uploaded HTML file for this activity?")) {
      return
    }

    setIsUploadingHtml(true)
    setHtmlUploadError(null)

    try {
      const response = await fetch(`/api/teacher/activities/${activity.id}/html`, { method: "DELETE" })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setHtmlUploadError(body.error || "Failed to remove HTML")
        return
      }

      setHtmlUrl(null)
      setHtmlFile(null)
    } catch (err) {
      setHtmlUploadError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsUploadingHtml(false)
    }
  }

  return (
    <div className="space-y-6">
      <article className="teacher-panel p-6 space-y-4">
        {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="teacher-eyebrow">Activity Settings</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{form.title}</h2>
          <p className="teacher-subtitle mt-1">Level {levelNumber}: {levelTitle}</p>
        </div>
        <label className="teacher-chip">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
          />
          Published
        </label>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="teacher-label">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="teacher-input"
          />
        </div>

        <div>
          <label className="teacher-label">Instructions</label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            className="teacher-textarea"
            rows={4}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="teacher-label">Type</label>
            <select
              value={form.activity_type}
              onChange={(e) => setForm({ ...form, activity_type: e.target.value as Activity["activity_type"] })}
              className="teacher-select"
            >
              <option value="quiz">Quiz</option>
              <option value="problem_solving">Problem Solving</option>
              <option value="reflection">Reflection</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className="teacher-label">Passing Score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.passing_score}
              onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })}
              className="teacher-input"
            />
          </div>
          <div>
            <label className="teacher-label">Sort Order</label>
            <input
              type="number"
              min="1"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="teacher-input"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="teacher-chip">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
              />
              Required
            </label>
          </div>
        </div>
      </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={saveActivity} disabled={saving} className="teacher-button disabled:opacity-50">
            {saving ? "Saving..." : "Save Activity"}
          </button>
          <button onClick={deleteActivity} disabled={saving} className="teacher-button-danger disabled:opacity-50">
            Delete Activity
          </button>
        </div>
      </article>

      <article className="teacher-panel p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="teacher-eyebrow">HTML Activity</p>
            <h3 className="text-lg font-semibold text-slate-900">Upload an HTML file</h3>
            <p className="teacher-helper mt-1">Upload a single HTML export from Lumi. Sanitized HTML will be rendered for students.</p>
          </div>
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="teacher-button-secondary"
            >
              Open HTML
            </a>
          )}
        </div>

        <div className="grid gap-3">
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null
              setHtmlFile(selected)
              setHtmlUploadError(null)
            }}
            className="teacher-input"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={uploadHtml}
              disabled={isUploadingHtml || !htmlFile}
              className="teacher-button disabled:opacity-50"
            >
              {isUploadingHtml ? "Uploading..." : "Upload HTML"}
            </button>
            {htmlUrl && (
              <button
                onClick={removeHtml}
                disabled={isUploadingHtml}
                className="teacher-button-danger disabled:opacity-50"
              >
                Remove HTML
              </button>
            )}
          </div>
        </div>

        {htmlUploadError && <p className="teacher-alert teacher-alert--error">{htmlUploadError}</p>}

{htmlUrl ? (
           <div className="teacher-panel-soft p-3">
             <p className="teacher-label mb-2">Preview</p>
             <HtmlActivityFrame
               activityId={activity.id}
               title="Activity HTML Preview"
               className="h-96 w-full rounded-lg border border-slate-200 bg-white"
               sandbox="allow-scripts"
             />
           </div>
         ) : (
          <p className="teacher-helper">No HTML uploaded yet.</p>
        )}
      </article>
    </div>
  )
}
