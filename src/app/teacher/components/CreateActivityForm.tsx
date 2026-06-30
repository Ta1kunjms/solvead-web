"use client";

import { FormEvent, useCallback, useState } from "react";

type Props = {
  levelId: string;
  levelNumber: number;
  onClose: () => void;
  onSaved?: () => void;
};

export function CreateActivityForm({ levelId, levelNumber, onClose, onSaved }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdActivityId, setCreatedActivityId] = useState<string | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [form, setForm] = useState({
    title: "",
    instructions: "",
    activity_type: "quiz" as string,
    passing_score: 70,
    sort_order: "",
    output_type: "none" as string,
    button_label: "Open Activity",
  });

  const uploadHtmlFile = useCallback(async (activityId: string) => {
    if (!htmlFile) return;

    // Step 1: Get presigned URL
    const presignRes = await fetch(`/api/teacher/activities/${activityId}/html/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: htmlFile.name,
        fileSize: htmlFile.size,
        fileType: htmlFile.type,
      }),
    });

    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => ({}));
      throw new Error(body.error || `Failed to get presigned URL (HTTP ${presignRes.status})`);
    }

    const { presignedUrl, storagePath } = await presignRes.json();

    // Step 2: Upload directly to Supabase Storage
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    await new Promise<void>((resolve, reject) => {
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", htmlFile.type);
      xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Upload failed due to network error"));
      xhr.send(htmlFile);
    });

    // Step 3: Confirm upload saved to DB
    const confirmRes = await fetch(`/api/teacher/activities/${activityId}/html/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    });

    if (!confirmRes.ok) {
      const body = await confirmRes.json().catch(() => ({}));
      throw new Error(body.error || `Failed to confirm upload (HTTP ${confirmRes.status})`);
    }
  }, [htmlFile]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);
      setError(null);
      setUploadError(null);
      setUploadProgress(0);

      try {
        if (createdActivityId) {
          if (!htmlFile) {
            setUploadError("Select an HTML file to upload");
            setIsSubmitting(false);
            return;
          }

          await uploadHtmlFile(createdActivityId);
          onSaved?.();
          onClose();
          return;
        }

        const title = form.title.trim();
        const instructions = form.instructions.trim();
        const passingScore = Number.isFinite(form.passing_score)
          ? Math.max(0, Math.min(100, Math.floor(form.passing_score)))
          : 0;
        const sortOrderValue = form.sort_order.trim();
        const sortOrderParsed = sortOrderValue ? Number(sortOrderValue) : Number.NaN;
        const sortOrder = Number.isFinite(sortOrderParsed)
          ? Math.max(1, Math.floor(sortOrderParsed))
          : null;

        if (!title) {
          setError("Activity title is required");
          setIsSubmitting(false);
          return;
        }

        const response = await fetch("/api/teacher/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level_id: levelId,
            title,
            instructions,
            activity_type: form.activity_type,
            passing_score: passingScore,
            sort_order: sortOrder ?? undefined,
            is_published: false,
            is_required: true,
            output_type: form.output_type,
            button_label: form.button_label,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Failed to create activity");
          setIsSubmitting(false);
          return;
        }

        const body = await response.json().catch(() => ({}));
        const newActivityId = typeof body.id === "string" ? body.id : null;

        if (htmlFile && newActivityId) {
          try {
            await uploadHtmlFile(newActivityId);
          } catch (uploadErr) {
            setUploadError(uploadErr instanceof Error ? uploadErr.message : "HTML upload failed");
            setCreatedActivityId(newActivityId);
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
    [createdActivityId, form, htmlFile, levelId, onClose, onSaved, uploadHtmlFile],
  );

  const isCreated = Boolean(createdActivityId);
  const submitLabel = isCreated ? "Upload HTML" : "Create Activity";
  const submitDisabled = isSubmitting || (isCreated && !htmlFile);

  return (
    <div className="teacher-modal">
      <article className="teacher-modal-card p-6">
        <h2 className="text-2xl font-semibold text-slate-900">Create Activity for Level {levelNumber}</h2>

        {isCreated && (
          <p className="teacher-helper mt-2">
            Activity created. Upload an HTML file to finish, or close and edit later.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="teacher-label">Activity Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Angle Classification Quiz"
              className="teacher-input"
              required
              disabled={isCreated}
            />
          </div>

          <div>
            <label className="teacher-label">Instructions</label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Guide students on how to complete this activity..."
              className="teacher-textarea"
              rows={3}
              disabled={isCreated}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Activity Type</label>
              <select
                value={form.activity_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    activity_type: e.target.value,
                  })
                }
                className="teacher-select"
                disabled={isCreated}
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    output_type: e.target.value,
                  })
                }
                className="teacher-select"
                disabled={isCreated}
              >
                <option value="none">None (no submission required)</option>
                <option value="photo">Photo Upload</option>
                <option value="file">File Upload</option>
                <option value="text">Text Response</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="teacher-label">Button Label</label>
              <input
                type="text"
                maxLength={50}
                value={form.button_label}
                onChange={(e) => setForm({ ...form, button_label: e.target.value })}
                placeholder="Open Activity"
                className="teacher-input"
                disabled={isCreated}
              />
              <p className="text-xs text-gray-400 mt-1">{form.button_label?.length ?? 0}/50</p>
            </div>

            <div>
              <label className="teacher-label">Passing Score (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.passing_score}
                onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })}
                className="teacher-input"
                required
                disabled={isCreated}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="teacher-label">Sort Order (optional)</label>
              <input
                type="number"
                min="1"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                placeholder="Auto"
                className="teacher-input"
                disabled={isCreated}
              />
            </div>

            <div>
              <label className="teacher-label">HTML Activity File (optional)</label>
              <input
                type="file"
                accept=".html,.htm,.zip,text/html,application/zip"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setHtmlFile(selected);
                  setUploadError(null);
                }}
                className="teacher-input"
                disabled={isSubmitting}
              />
              <p className="teacher-helper mt-1">Upload html/zip.</p>
            </div>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
              <p className="text-xs text-slate-500 mt-1">{uploadProgress}% uploaded</p>
            </div>
          )}

          {error && <p className="teacher-alert teacher-alert--error">{error}</p>}
          {uploadError && <p className="teacher-alert teacher-alert--error">{uploadError}</p>}

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="teacher-button-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitDisabled} className="teacher-button flex-1 disabled:opacity-50">
              {isSubmitting ? "Working..." : submitLabel}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
