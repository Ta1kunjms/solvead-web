"use client";

import { FormEvent, useCallback, useState } from "react";
import { uploadLessonResource } from "@/lib/lesson-resource-upload";

type Props = {
  levelId: string;
  levelNumber: number;
  onClose: () => void;
  onSaved?: () => void;
};

export function CreateLessonForm({ levelId, levelNumber, onClose, onSaved }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    content_markdown: "",
    ppt_url: "",
  });
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setError(null);
      setUploadProgress(0);

      try {
        const title = form.title.trim();
        const summary = form.summary.trim();
        const content = form.content_markdown.trim();
        const pptUrl = form.ppt_url.trim();

        if (!title) {
          setError("Lesson title is required");
          setIsSubmitting(false);
          return;
        }

        let lessonId = createdLessonId;

        if (!lessonId) {
          const response = await fetch("/api/teacher/lessons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level_id: levelId,
              title,
              summary,
              content_markdown: content,
              ppt_url: resourceFile ? "" : pptUrl,
              is_published: false,
            }),
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            setError(data.error || "Failed to create lesson");
            setIsSubmitting(false);
            return;
          }

          lessonId = data.id;
          if (!lessonId) {
            setError("Lesson created but no id was returned");
            setIsSubmitting(false);
            return;
          }

          setCreatedLessonId(lessonId);

          if (!resourceFile) {
            onSaved?.();
            onClose();
            return;
          }
        }

        if (resourceFile && lessonId) {
          try {
            await uploadLessonResource({
              lessonId,
              file: resourceFile,
              onProgress: setUploadProgress,
            });
          } catch (uploadErr) {
            setError(
              uploadErr instanceof Error
                ? `Lesson created but resource upload failed: ${uploadErr.message}`
                : "Lesson created but resource upload failed",
            );
            setIsSubmitting(false);
            return;
          }
        }

        onSaved?.();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsSubmitting(false);
      }
    },
    [levelId, form, onClose, onSaved, resourceFile, createdLessonId],
  );

  return (
    <div className="teacher-modal">
      <article className="teacher-modal-card p-6">
        <h2 className="text-2xl font-semibold text-slate-900">Create Lesson for Level {levelNumber}</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="teacher-label">Lesson Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Understanding Angles"
              className="teacher-input"
              required
            />
          </div>

          <div>
            <label className="teacher-label">Summary</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Brief overview of the lesson..."
              className="teacher-textarea"
              rows={2}
            />
          </div>

          <div>
            <label className="teacher-label">Content (Markdown)</label>
            <textarea
              value={form.content_markdown}
              onChange={(e) => setForm({ ...form, content_markdown: e.target.value })}
              placeholder="Lesson content in markdown format..."
              className="teacher-textarea"
              rows={4}
            />
          </div>

          <div>
            <label className="teacher-label">PPT/Resource URL</label>
            <input
              type="url"
              value={form.ppt_url}
              onChange={(e) => setForm({ ...form, ppt_url: e.target.value })}
              placeholder="https://example.com/presentation.pptx"
              className="teacher-input"
              disabled={Boolean(resourceFile)}
            />
          </div>

          <div>
            <label className="teacher-label">Upload Resource File (PPT/PDF/Lumi)</label>
            <input
              type="file"
              accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.h5p,.lumi"
              onChange={(e) => {
                setResourceFile(e.target.files?.[0] ?? null);
                setUploadProgress(0);
              }}
              className="teacher-input"
            />
            {resourceFile && (
              <p className="mt-1 text-xs text-slate-500">Selected: {resourceFile.name}</p>
            )}
            {isSubmitting && uploadProgress > 0 && uploadProgress < 100 ? (
              <div className="mt-2">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Uploading {uploadProgress}%</p>
              </div>
            ) : null}
          </div>

          {error && <p className="teacher-alert teacher-alert--error">{error}</p>}

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="teacher-button-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="teacher-button flex-1 disabled:opacity-50">
              {isSubmitting
                ? uploadProgress > 0 && uploadProgress < 100
                  ? `Uploading ${uploadProgress}%`
                  : "Creating..."
                : "Create Lesson"}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
