export type ResourceUploadProgress = (percent: number) => void;

export type ResourceUploadResult = {
  path: string;
  ppt_url: string;
};

export class ResourceUploadError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ResourceUploadError";
    this.status = status;
  }
}

export async function uploadLessonResource(params: {
  lessonId: string;
  file: File;
  onProgress?: ResourceUploadProgress;
}): Promise<ResourceUploadResult> {
  const { lessonId, file, onProgress } = params;

  const signResponse = await fetch(
    `/api/teacher/lessons/${lessonId}/resource/upload-url?name=${encodeURIComponent(file.name)}`,
  );

  const signBody = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok) {
    throw new ResourceUploadError(
      signBody.error || `Could not start upload (HTTP ${signResponse.status})`,
      signResponse.status,
    );
  }

  const { path, token, signedUrl } = signBody as {
    path?: string;
    token?: string;
    signedUrl?: string;
  };

  if (!path || !token || !signedUrl) {
    throw new ResourceUploadError("Upload service did not return a valid signed URL");
  }

  const contentType = file.type || "application/octet-stream";

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0 && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        let message = `Upload failed (HTTP ${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.message) message = body.message;
        } catch {
          if (xhr.responseText) message = xhr.responseText;
        }
        reject(new ResourceUploadError(message, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ResourceUploadError("Network error during upload"));
    xhr.onabort = () => reject(new ResourceUploadError("Upload aborted"));
    xhr.send(file);
  });

  const finalizeResponse = await fetch(`/api/teacher/lessons/${lessonId}/resource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  const finalizeBody = await finalizeResponse.json().catch(() => ({}));
  if (!finalizeResponse.ok) {
    throw new ResourceUploadError(
      finalizeBody.error || `Upload finished but the link could not be saved (HTTP ${finalizeResponse.status})`,
      finalizeResponse.status,
    );
  }

  return {
    path,
    ppt_url: finalizeBody.ppt_url as string,
  };
}
