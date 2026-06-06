'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"

type Lesson = {
  id: string
  level_id: string
  title: string
  summary: string | null
  content_markdown: string | null
  ppt_url: string | null
  is_published: boolean
  sort_order: number
}

type Props = {
  lesson: Lesson
  levelNumber: number
  levelTitle: string
}

export function LessonEditorPanel({ lesson, levelNumber, levelTitle }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: lesson.title,
    summary: lesson.summary ?? "",
    content_markdown: lesson.content_markdown ?? "",
    ppt_url: lesson.ppt_url ?? "",
    is_published: lesson.is_published,
    sort_order: lesson.sort_order,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resourceUrl, setResourceUrl] = useState<string | null>(lesson.ppt_url ?? null)
  const [resourceFile, setResourceFile] = useState<File | null>(null)
  const [isUploadingResource, setIsUploadingResource] = useState(false)
  const [resourceUploadError, setResourceUploadError] = useState<string | null>(null)

  const saveLesson = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to save lesson")
        return
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const deleteLesson = async () => {
    if (!window.confirm("Delete this lesson? This cannot be undone.")) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.error || "Failed to delete lesson")
        return
      }

      router.push("/teacher/content")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const uploadResource = async () => {
    if (!resourceFile) {
      setResourceUploadError("Select a file to upload")
      return
    }

    setIsUploadingResource(true)
    setResourceUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", resourceFile)

      const response = await fetch(`/api/teacher/lessons/${lesson.id}/resource`, {
        method: "POST",
        body: formData,
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setResourceUploadError(body.error || `Upload failed (HTTP ${response.status})`)
        return
      }

      const url = body.ppt_url || null
      setResourceUrl(url)
      setResourceFile(null)
      setForm((current) => ({ ...current, ppt_url: url || "" }))
      router.refresh()
    } catch (err) {
      setResourceUploadError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsUploadingResource(false)
    }
  }

  const removeResource = async () => {
    if (!resourceUrl) {
      return
    }

    if (!window.confirm("Remove the uploaded resource file for this lesson?")) {
      return
    }

    setIsUploadingResource(true)
    setResourceUploadError(null)

    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}/resource`, { method: "DELETE" })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setResourceUploadError(body.error || "Failed to remove resource")
        return
      }

      setResourceUrl(null)
      setResourceFile(null)
      setForm((current) => ({ ...current, ppt_url: "" }))
      router.refresh()
    } catch (err) {
      setResourceUploadError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsUploadingResource(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

      <article className="teacher-panel p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="teacher-eyebrow">Lesson Settings</p>
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
            <label className="teacher-label">Summary</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="teacher-textarea"
              rows={2}
            />
          </div>

          <div>
            <label className="teacher-label">Content Markdown</label>
            <textarea
              value={form.content_markdown}
              onChange={(e) => setForm({ ...form, content_markdown: e.target.value })}
              className="teacher-textarea"
              rows={10}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Resource URL</label>
              <input
                type="url"
                value={form.ppt_url}
                onChange={(e) => {
                  const value = e.target.value
                  setForm({ ...form, ppt_url: value })
                  setResourceUrl(value.trim() ? value : null)
                }}
                className="teacher-input"
              />
              {resourceUrl ? (
                <a href={resourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs text-slate-600 underline">
                  View current resource
                </a>
              ) : null}
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Upload Resource File (PPT/PDF/Lumi)</label>
              <input
                type="file"
                accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.h5p,.lumi"
                onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)}
                className="teacher-input"
              />
              {resourceFile ? (
                <p className="mt-1 text-xs text-slate-500">Selected: {resourceFile.name}</p>
              ) : null}
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={uploadResource}
                disabled={isUploadingResource}
                className="teacher-button disabled:opacity-50"
              >
                {isUploadingResource ? "Uploading..." : "Upload File"}
              </button>
              <button
                type="button"
                onClick={removeResource}
                disabled={isUploadingResource || !resourceUrl}
                className="teacher-button-ghost disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
          {resourceUploadError && <p className="teacher-alert teacher-alert--error">{resourceUploadError}</p>}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={saveLesson} disabled={saving} className="teacher-button disabled:opacity-50">
            {saving ? "Saving..." : "Save Lesson"}
          </button>
          <button onClick={deleteLesson} disabled={saving} className="teacher-button-danger disabled:opacity-50">
            Delete Lesson
          </button>
        </div>
      </article>

      <article className="teacher-panel p-6 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
        <div>
          <p className="teacher-label">Summary</p>
          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{form.summary || "No summary"}</p>
        </div>
        <div>
          <p className="teacher-label">Content</p>
          <pre className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
            {form.content_markdown || "No content"}
          </pre>
        </div>
      </article>
    </div>
  )
}
