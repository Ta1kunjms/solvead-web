import { NextRequest, NextResponse } from "next/server";
import { applyPassedActivityOutcome } from "@/lib/activity-outcomes";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildScreenshotStoragePath,
  SCREENSHOT_BUCKET,
  validateScreenshotFile,
} from "@/lib/screenshot";

type SubmitHtmlResultRequest = {
  activity_id: string;
  session_id: string;
  score: number;
  max_score: number;
  points?: number;
  stars?: number;
  passed?: boolean;
  text_response?: string;
  submission_file?: any;
};

const asFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asSafeText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readMultipartValue = (formData: FormData, key: string) => formData.get(key);

const parseFormRequest = async (request: NextRequest) => {
  const formData = await request.formData();
  const screenshotEntry = readMultipartValue(formData, "screenshot");
  const submissionFileEntry = readMultipartValue(formData, "submission_file");

  return {
    activity_id: asSafeText(readMultipartValue(formData, "activity_id")),
    session_id: asSafeText(readMultipartValue(formData, "session_id")),
    score: readMultipartValue(formData, "score"),
    max_score: readMultipartValue(formData, "max_score"),
    points: readMultipartValue(formData, "points"),
    stars: readMultipartValue(formData, "stars"),
    passed: readMultipartValue(formData, "passed"),
    screenshot: screenshotEntry instanceof File ? screenshotEntry : null,
    submission_file: submissionFileEntry instanceof File ? submissionFileEntry : null,
    text_response: asSafeText(readMultipartValue(formData, "text_response")),
  };
};

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("multipart/form-data")
    ? await parseFormRequest(request)
    : ((await request.json()) as SubmitHtmlResultRequest);

  const activityId = asSafeText(body.activity_id);
  const sessionId = asSafeText(body.session_id);
  const rawScore = asFiniteNumber(body.score);
  const rawMaxScore = asFiniteNumber(body.max_score);
  const rawPoints = asFiniteNumber(body.points);
  const stars = Math.max(0, Math.min(5, Math.round(asFiniteNumber(body.stars) ?? 0)));

  if (!activityId || !sessionId || rawScore === null || rawMaxScore === null) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  if (rawScore < 0) {
    return NextResponse.json({ error: "Score values must be non-negative" }, { status: 400 });
  }

  if (rawMaxScore <= 0) {
    return NextResponse.json(
      { error: "max_score must be a positive number" },
      { status: 400 },
    );
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, level_id, passing_score, activity_type, output_type")
    .eq("id", activityId)
    .maybeSingle();

  if (activityError || !activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const UNGRADED_TYPES = ["motivation", "reading", "reference"];
  const isUngraded = UNGRADED_TYPES.includes(activity.activity_type ?? "");

  // Force pass for ungraded activities
  let score = rawScore;
  let maxScore = rawMaxScore;

  if (isUngraded) {
    score = 100;
    maxScore = 100;
  } else {
    maxScore = Math.round(rawMaxScore);
    score = Math.max(0, Math.min(maxScore, Math.round(rawScore)));
  }

  const points =
    rawPoints === null
      ? score
      : Math.max(0, Math.min(maxScore, Math.round(rawPoints)));

  const sessionMarker = `session:${sessionId}`;

  const { data: existingAttempt } = await supabase
    .from("activity_attempts")
    .select("id, score, max_score, passed")
    .eq("student_id", user.id)
    .eq("activity_id", activityId)
    .order("submitted_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scorePct = Math.round((score / maxScore) * 100);
  const passingScore = Number(activity.passing_score ?? 70);
  const passed = isUngraded ? true : scorePct >= passingScore;

  const feedbackSummary = [
    `Score: ${scorePct}%. ${passed ? "Level unlock eligible!" : "Try again to improve."}`,
    `Source: html-game`,
    sessionMarker,
    `stars:${stars}`,
  ].join(" ");

  const now = new Date().toISOString();
  const attemptId = existingAttempt?.id ?? crypto.randomUUID();

  // Output type conditional validation
  const outputType = activity.output_type ?? "none";
  let screenshotPath: string | null = null;
  let screenshotMimeType: string | null = null;
  let screenshotSizeBytes: number | null = null;
  let textResponse: string | null = null;

  if (outputType === "text") {
    const textVal = "text_response" in body ? body.text_response : null;
    if (!textVal || textVal.trim() === "") {
      return NextResponse.json({ error: "text_response is required" }, { status: 400 });
    }
    textResponse = textVal.trim();
  } else if (outputType === "photo") {
    const screenshot = "screenshot" in body ? body.screenshot : null;
    if (!screenshot) {
      return NextResponse.json({ error: "Photo upload required" }, { status: 400 });
    }
    const screenshotValidation = await validateScreenshotFile(screenshot);
    if ("error" in screenshotValidation) {
      return NextResponse.json({ error: screenshotValidation.error }, { status: 400 });
    }

    screenshotPath = buildScreenshotStoragePath(user.id, activity.id, attemptId, screenshotValidation.extension);
    screenshotMimeType = screenshotValidation.mimeType;
    screenshotSizeBytes = screenshotValidation.sizeBytes;

    const { error: uploadError } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(screenshotPath, screenshotValidation.buffer, {
      contentType: screenshotValidation.mimeType,
      cacheControl: "60",
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  } else if (outputType === "file") {
    const file = "submission_file" in body ? body.submission_file : null;
    if (!file) {
      return NextResponse.json({ error: "File upload required" }, { status: 400 });
    }
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 });
    }

    screenshotPath = `submissions/${activityId}/${user.id}/${Date.now()}_${file.name}`;
    screenshotMimeType = file.type;
    screenshotSizeBytes = file.size;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("activity-html").upload(screenshotPath, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  const persistPayload: Record<string, any> = {
    score: Math.round(points),
    max_score: Math.round(maxScore),
    passed,
    status: "graded",
    submitted_at: now,
    feedback_summary: feedbackSummary,
    text_response: textResponse,
    screenshot_path: screenshotPath,
    screenshot_mime_type: screenshotMimeType,
    screenshot_size_bytes: screenshotSizeBytes,
    screenshot_uploaded_at: screenshotPath ? now : null,
  };

  const persistAttempt = existingAttempt
    ? supabase
        .from("activity_attempts")
        .update({
          ...persistPayload,
          updated_at: now,
        })
        .eq("id", existingAttempt.id)
        .select("id")
        .single()
    : supabase
        .from("activity_attempts")
        .insert({
          id: attemptId,
          student_id: user.id,
          activity_id: activity.id,
          ...persistPayload,
        })
        .select("id")
        .single();

  const { data: savedAttempt, error: attemptError } = await persistAttempt;

  if (attemptError || !savedAttempt) {
    if (screenshotPath) {
      const bucket = outputType === "file" ? "activity-html" : SCREENSHOT_BUCKET;
      await supabase.storage.from(bucket).remove([screenshotPath]);
    }
    return NextResponse.json({ error: "Failed to save html result" }, { status: 500 });
  }

  if (passed) {
    await applyPassedActivityOutcome({
      supabase,
      userId: user.id,
      activityId,
      levelId: activity.level_id,
      pointsAwarded: points,
      scorePercent: scorePct,
    });
  }

  return NextResponse.json({
    attempt_id: savedAttempt.id,
    duplicate: false,
    score: scorePct,
    passed,
    total_points: Math.round(points),
    max_score: Math.round(maxScore),
    stars,
    feedback: `Score: ${scorePct}%. ${passed ? "Level unlock eligible!" : "Try again to improve."}`,
  });
}
