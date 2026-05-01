type ApplyPassedActivityOutcomeParams = {
  supabase: any;
  userId: string;
  activityId: string;
  levelId: string;
  pointsAwarded: number;
  scorePercent?: number;
};

export async function applyPassedActivityOutcome({
  supabase,
  userId,
  activityId,
  levelId,
  pointsAwarded,
  scorePercent,
}: ApplyPassedActivityOutcomeParams) {
  const pointsReason = `Completed activity: ${activityId}`;
  const { data: existingPointsReward } = await supabase
    .from("user_rewards")
    .select("id")
    .eq("user_id", userId)
    .eq("reward_type", "points")
    .eq("reason", pointsReason)
    .limit(1)
    .maybeSingle();

  if (!existingPointsReward) {
    await supabase.from("user_rewards").insert({
      user_id: userId,
      level_id: levelId,
      reward_type: "points",
      points: Math.max(0, Math.round(pointsAwarded)),
      reason: pointsReason,
    });
  }

  const { data: levelData } = await supabase
    .from("levels")
    .select("level_number")
    .eq("id", levelId)
    .maybeSingle();

  const resolvedLevelData = levelData as { level_number: number } | null;

  if (!resolvedLevelData) {
    return;
  }

  const { data: allActivities } = await supabase
    .from("activities")
    .select("id, is_required")
    .eq("level_id", levelId)
    .eq("is_required", true);

  const requiredActivities = (allActivities ?? []) as Array<{ id: string }>;

  if (requiredActivities.length === 0) {
    return;
  }

  const { data: completedAttempts } = await supabase
    .from("activity_attempts")
    .select("activity_id")
    .eq("student_id", userId)
    .eq("passed", true)
    .in(
      "activity_id",
      requiredActivities.map((activity) => activity.id),
    );

  const completedRows = (completedAttempts ?? []) as Array<{ activity_id: string }>;
  const completedIds = new Set(completedRows.map((attempt) => attempt.activity_id));
  const allCompleted = requiredActivities.every((activity) => completedIds.has(activity.id));

  if (!allCompleted) {
    return;
  }

  const now = new Date().toISOString();
  const { data: currentProgress } = await supabase
    .from("level_progress")
    .select("completed, best_score")
    .eq("user_id", userId)
    .eq("level_number", resolvedLevelData.level_number)
    .maybeSingle();

  const previousBest = typeof currentProgress?.best_score === "number" ? currentProgress.best_score : null;
  const incomingBest = typeof scorePercent === "number" ? Math.max(0, Math.min(100, Math.round(scorePercent))) : null;
  const bestScore =
    incomingBest === null
      ? previousBest
      : previousBest === null
        ? incomingBest
        : Math.max(previousBest, incomingBest);

  await supabase
    .from("level_progress")
    .upsert(
      {
        user_id: userId,
        level_number: resolvedLevelData.level_number,
        completed: true,
        unlocked: true,
        best_score: bestScore,
        updated_at: now,
      },
      { onConflict: "user_id,level_number" },
    );

  if (resolvedLevelData.level_number < 15) {
    await supabase
      .from("level_progress")
      .upsert(
        {
          user_id: userId,
          level_number: resolvedLevelData.level_number + 1,
          unlocked: true,
          updated_at: now,
        },
        { onConflict: "user_id,level_number" },
      );
  }

  if (!currentProgress?.completed) {
    await supabase.from("user_rewards").insert({
      user_id: userId,
      level_id: levelId,
      reward_type: "star",
      stars: 1,
      reason:
        resolvedLevelData.level_number < 15
          ? `Unlocked Level ${resolvedLevelData.level_number + 1}`
          : `Completed Level ${resolvedLevelData.level_number}`,
    });
  }
}
