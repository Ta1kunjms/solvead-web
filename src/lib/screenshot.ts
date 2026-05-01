export const SCREENSHOT_BUCKET = "activity-screenshots";
export const MAX_SCREENSHOT_SIZE_BYTES = 8 * 1024 * 1024;
export const SCREENSHOT_ACCEPT = "image/jpeg,image/png,image/webp";

const ALLOWED_SCREENSHOT_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type ScreenshotFormat = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export type ScreenshotValidationSuccess = {
  buffer: Buffer;
  sizeBytes: number;
  mimeType: ScreenshotFormat["mimeType"];
  extension: ScreenshotFormat["extension"];
};

export type ScreenshotValidationError = {
  error: string;
};

export type ScreenshotValidationResult = ScreenshotValidationSuccess | ScreenshotValidationError;

const isPng = (bytes: Uint8Array) =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47 &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a &&
  bytes[6] === 0x1a &&
  bytes[7] === 0x0a;

const isJpeg = (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const isWebp = (bytes: Uint8Array) =>
  bytes.length >= 12 &&
  bytes[0] === 0x52 &&
  bytes[1] === 0x49 &&
  bytes[2] === 0x46 &&
  bytes[3] === 0x46 &&
  bytes[8] === 0x57 &&
  bytes[9] === 0x45 &&
  bytes[10] === 0x42 &&
  bytes[11] === 0x50;

const detectScreenshotFormat = (bytes: Uint8Array): ScreenshotFormat | null => {
  if (isJpeg(bytes)) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  if (isPng(bytes)) {
    return { mimeType: "image/png", extension: "png" };
  }

  if (isWebp(bytes)) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  return null;
};

export const validateScreenshotFile = async (file: File | null | undefined): Promise<ScreenshotValidationResult> => {
  if (!(file instanceof File)) {
    return { error: "Screenshot is required" };
  }

  if (file.size <= 0) {
    return { error: "Screenshot file is empty" };
  }

  if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
    return { error: "Screenshot must be 8MB or smaller" };
  }

  if (file.type && !ALLOWED_SCREENSHOT_MIME_TYPES.has(file.type)) {
    return { error: "Screenshot must be a JPG, PNG, or WEBP image" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedFormat = detectScreenshotFormat(buffer);

  if (!detectedFormat) {
    return { error: "Screenshot file is malformed or unsupported" };
  }

  if (file.type && file.type !== detectedFormat.mimeType) {
    return { error: "Screenshot mime type does not match the file contents" };
  }

  return {
    buffer,
    sizeBytes: buffer.byteLength,
    mimeType: detectedFormat.mimeType,
    extension: detectedFormat.extension,
  };
};

export const buildScreenshotStoragePath = (
  userId: string,
  activityId: string,
  attemptId: string,
  extension: ScreenshotFormat["extension"],
) => `${userId}/${activityId}/${attemptId}.${extension}`;