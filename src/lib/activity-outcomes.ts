type ApplyPassedActivityOutcomeParams = {
  supabase: any;
  userId: string;
  activityId: string;
  levelId: string;
  pointsAwarded: number;
};

export async function applyPassedActivityOutcome({
  supabase,
  userId,
  activityId,
  levelId,
  pointsAwarded,
}: ApplyPassedActivityOutcomeParams) {
  await supabase.from("user_rewards").insert({
    user_id: userId,
    level_id: levelId,
    reward_type: "points",
    points: Math.max(0, Math.round(pointsAwarded)),
    reason: `Completed activity: ${activityId}`,
  });

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
    .select("completed")
    .eq("user_id", userId)
    .eq("level_number", resolvedLevelData.level_number)
    .maybeSingle();

  await supabase
    .from("level_progress")
    .update({ completed: true, unlocked: true, updated_at: now })
    .eq("user_id", userId)
    .eq("level_number", resolvedLevelData.level_number);

  if (resolvedLevelData.level_number < 15) {
    await supabase
      .from("level_progress")
      .update({ unlocked: true, updated_at: now })
      .eq("user_id", userId)
      .eq("level_number", resolvedLevelData.level_number + 1);
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
