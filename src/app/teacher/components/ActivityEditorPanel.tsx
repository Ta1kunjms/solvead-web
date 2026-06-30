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
  activity_type: "quiz" | "graded" | "motivation" | "reading" | "reference" | "game" | "other" | "problem_solving" | "reflection" | "mixed"
  passing_score: number
  is_required: boolean
  is_published: boolean
  sort_order: number
  output_type: "none" | "photo" | "file" | "text"
  button_label: string
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
    output_type: activity.output_type ?? "none",
    button_label: activity.button_label ?? "Open Activity",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [htmlUrl, setHtmlUrl] = useState<string | null>(activity.html_url ?? null)
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [isUploadingHtml, setIsUploadingHtml] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
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
    setUploadProgress(0)

    try {
      // Step A: Get presigned URL from server
      setUploadProgress(0)
      const presignResponse = await fetch(`/api/teacher/activities/${activity.id}/html/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: htmlFile.name,
          fileSize: htmlFile.size,
          fileType: htmlFile.type || "application/octet-stream",
        }),
      })

      if (!presignResponse.ok) {
        const body = await presignResponse.json().catch(() => ({}))
        setHtmlUploadError(body.error || `Failed to initialize upload (HTTP ${presignResponse.status})`)
        return
      }

      const { presignedUrl, storagePath } = await presignResponse.json()

      // Step B: Upload file directly to Supabase Storage via presigned URL
      const uploadResult = await new Promise<{ ok: boolean; statusText: string }>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", presignedUrl)
        xhr.setRequestHeader("Content-Type", htmlFile.type || "application/octet-stream")
        xhr.setRequestHeader("x-upsert", "true")

        xhr.upload.addEventListener("progress", (event: ProgressEvent) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(progress)
          }
        })

        xhr.addEventListener("load", () => {
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, statusText: xhr.statusText })
        })

        xhr.addEventListener("error", () => {
          resolve({ ok: false, statusText: "Network error" })
        })

        xhr.send(htmlFile)
      })

      if (!uploadResult.ok) {
        setHtmlUploadError(`Upload failed: ${uploadResult.statusText}`)
        return
      }

      setUploadProgress(100)

      // Step C: Confirm upload and process on server
      const confirmResponse = await fetch(`/api/teacher/activities/${activity.id}/html/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      })

      if (!confirmResponse.ok) {
        const body = await confirmResponse.json().catch(() => ({}))
        setHtmlUploadError(body.error || `Failed to process upload (HTTP ${confirmResponse.status})`)
        return
      }

      const confirmData = await confirmResponse.json()
      setHtmlUrl(confirmData.htmlUrl || null)
      setHtmlFile(null)
      setUploadProgress(0)
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="teacher-label">Type</label>
            <select
              value={form.activity_type}
              onChange={(e) => setForm({ ...form, activity_type: e.target.value as Activity["activity_type"] })}
              className="teacher-select"
            >
              <option value="quiz">Quiz</option>
              <option value="graded">Graded</option>
              <option value="game">Game</option>
              <option value="motivation">Motivation</option>
              <option value="reading">Reading</option>
              <option value="reference">Reference</option>
              <option value="problem_solving">Problem Solving</option>
              <option value="reflection">Reflection</option>
              <option value="mixed">Mixed</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="teacher-label">Student Output Type</label>
            <select
              value={form.output_type}
              onChange={(e) => setForm({ ...form, output_type: e.target.value as Activity["output_type"] })}
              className="teacher-select"
            >
              <option value="none">None (no submission required)</option>
              <option value="photo">Photo Upload</option>
              <option value="file">File Upload</option>
              <option value="text">Text Response</option>
            </select>
          </div>

          <div>
            <label className="teacher-label">Button Label</label>
            <input
              type="text"
              maxLength={50}
              value={form.button_label}
              onChange={(e) => setForm({ ...form, button_label: e.target.value })}
              className="teacher-input"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="teacher-label">Passing Score (%)</label>
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
          <div className="flex items-end gap-2 pb-2">
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
            <p className="teacher-helper mt-1">Upload the HTML export from Lumi, or a ZIP of the full export folder.</p>
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
            accept=".html,.htm,.zip,text/html,application/zip"
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
            {isUploadingHtml && uploadProgress > 0 && (
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
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
               sandbox="allow-scripts allow-same-origin"
             />
           </div>
         ) : (
          <p className="teacher-helper">No HTML uploaded yet.</p>
        )}
      </article>
    </div>
  )
}
