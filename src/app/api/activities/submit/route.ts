import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { applyPassedActivityOutcome } from "@/lib/activity-outcomes";

type AttemptResponse = {
  item_id: string;
  response_text: string;
  is_correct?: boolean;
};

type SubmitActivityRequest = {
  activity_id: string;
  responses: AttemptResponse[];
};

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

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

  const body: SubmitActivityRequest = await request.json();
  const { activity_id, responses } = body;

  if (!activity_id || !Array.isArray(responses) || responses.length === 0) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id, level_id, is_required, passing_score")
    .eq("id", activity_id)
    .maybeSingle();

  if (activityError || !activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("activity_items")
    .select("id, max_points, answer_key, item_type")
    .eq("activity_id", activity_id);

  if (itemsError || !items) {
    return NextResponse.json({ error: "Failed to load activity items" }, { status: 500 });
  }

  let totalPoints = 0;
  let maxScore = 0;
  const answerRecords: Array<{
    attempt_id?: string;
    item_id: string;
    response_text: string;
    is_correct?: boolean;
    points_earned?: number;
  }> = [];

  for (const response of responses) {
    const item = items.find((i) => i.id === response.item_id);
    if (!item) continue;

    const responseText = typeof response.response_text === "string" ? response.response_text.trim() : "";
    const answerKey = typeof item.answer_key === "string" ? item.answer_key.trim() : "";
    const normalizedResponse = normalizeText(responseText);
    const normalizedAnswer = normalizeText(answerKey);
    const hasResponse = normalizedResponse.length > 0;

    let isCorrect = false;
    if (item.item_type === "reflection") {
      isCorrect = hasResponse;
    } else if (!answerKey) {
      isCorrect = hasResponse;
    } else {
      isCorrect = normalizedResponse === normalizedAnswer;
    }

    const pointsEarned = isCorrect ? item.max_points : 0;

    totalPoints += pointsEarned;
    maxScore += item.max_points;

    answerRecords.push({
      item_id: response.item_id,
      response_text: responseText,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    });
  }

  const scorePct = maxScore > 0 ? Math.round((totalPoints / maxScore) * 100) : 0;
  const passed = scorePct >= (activity.passing_score || 70);

  const { data: newAttempt, error: attemptError } = await supabase
    .from("activity_attempts")
    .insert({
      student_id: user.id,
      activity_id: activity.id,
      score: totalPoints,
      max_score: maxScore,
      passed,
      status: "graded",
      submitted_at: new Date().toISOString(),
      feedback_summary: `Score: ${scorePct}%. ${passed ? "Level unlock eligible!" : "Try again to improve."}`,
    })
    .select("id")
    .single();

  if (attemptError || !newAttempt) {
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 });
  }

  for (const answer of answerRecords) {
    await supabase.from("activity_attempt_answers").insert({
      attempt_id: newAttempt.id,
      item_id: answer.item_id,
      response_text: answer.response_text,
      is_correct: answer.is_correct,
      points_earned: answer.points_earned,
    });
  }

  if (passed) {
    await applyPassedActivityOutcome({
      supabase,
      userId: user.id,
      activityId: activity_id,
      levelId: activity.level_id,
      pointsAwarded: 10,
    });
  }

  return NextResponse.json({
    attempt_id: newAttempt.id,
    score: scorePct,
    passed,
    total_points: totalPoints,
    max_score: maxScore,
    feedback: `Score: ${scorePct}%. ${passed ? "Level unlock eligible!" : "Try again to improve."}`,
  });
}
