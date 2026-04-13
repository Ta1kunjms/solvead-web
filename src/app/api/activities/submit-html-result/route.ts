import { NextRequest, NextResponse } from "next/server";
import { applyPassedActivityOutcome } from "@/lib/activity-outcomes";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SubmitHtmlResultRequest = {
  activity_id: string;
  session_id: string;
  score: number;
  max_score: number;
  points?: number;
  stars?: number;
  passed?: boolean;
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

  const body = (await request.json()) as SubmitHtmlResultRequest;
  const activityId = asSafeText(body.activity_id);
  const sessionId = asSafeText(body.session_id);
  const score = asFiniteNumber(body.score);
  const maxScore = asFiniteNumber(body.max_score);
  const points = asFiniteNumber(body.points) ?? score;
  const stars = Math.max(0, Math.min(5, Math.round(asFiniteNumber(body.stars) ?? 0)));

  if (!activityId || !sessionId || score === null || maxScore === null || points === null) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  if (score < 0 || maxScore <= 0 || points < 0) {
    return NextResponse.json({ error: "Score values must be non-negative" }, { status: 400 });
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, level_id, passing_score")
    .eq("id", activityId)
    .maybeSingle();

  if (activityError || !activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const sessionMarker = `session:${sessionId}`;

  const { data: existingAttempt } = await supabase
    .from("activity_attempts")
    .select("id, score, max_score, passed")
    .eq("student_id", user.id)
    .eq("activity_id", activityId)
    .ilike("feedback_summary", `%${sessionMarker}%`)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAttempt) {
    const existingScorePct =
      existingAttempt.max_score > 0
        ? Math.round((Number(existingAttempt.score ?? 0) / Number(existingAttempt.max_score ?? 1)) * 100)
        : 0;

    return NextResponse.json({
      attempt_id: existingAttempt.id,
      duplicate: true,
      score: existingScorePct,
      passed: Boolean(existingAttempt.passed),
      total_points: Number(existingAttempt.score ?? 0),
      max_score: Number(existingAttempt.max_score ?? 0),
    });
  }

  const scorePct = Math.round((score / maxScore) * 100);
  const passingScore = Number(activity.passing_score ?? 70);
  const passed = typeof body.passed === "boolean" ? body.passed : scorePct >= passingScore;

  const feedbackSummary = [
    `Score: ${scorePct}%. ${passed ? "Level unlock eligible!" : "Try again to improve."}`,
    `Source: html-game`,
    sessionMarker,
    `stars:${stars}`,
  ].join(" ");

  const { data: newAttempt, error: attemptError } = await supabase
    .from("activity_attempts")
    .insert({
      student_id: user.id,
      activity_id: activity.id,
      score: Math.round(points),
      max_score: Math.round(maxScore),
      passed,
      status: "graded",
      submitted_at: new Date().toISOString(),
      feedback_summary: feedbackSummary,
    })
    .select("id")
    .single();

  if (attemptError || !newAttempt) {
    return NextResponse.json({ error: "Failed to save html result" }, { status: 500 });
  }

  if (passed) {
    await applyPassedActivityOutcome({
      supabase,
      userId: user.id,
      activityId,
      levelId: activity.level_id,
      pointsAwarded: points,
    });
  }

  return NextResponse.json({
    attempt_id: newAttempt.id,
    duplicate: false,
    score: scorePct,
    passed,
    total_points: Math.round(points),
    max_score: Math.round(maxScore),
    stars,
    feedback: `Score: ${scorePct}%. ${passed ? "Level unlock eligible!" : "Try again to improve."}`,
  });
}
