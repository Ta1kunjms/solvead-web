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
  const { data: activity } = await supabase
    .from("activities")
    .select("activity_type")
    .eq("id", activityId)
    .maybeSingle();

  const UNGRADED_TYPES = ["motivation", "reading", "reference"];
  const isUngraded = UNGRADED_TYPES.includes(activity?.activity_type ?? "");

  if (!isUngraded) {
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
    .select("completed, best_score, approval_status, unlocked")
    .eq("user_id", userId)
    .eq("level_number", resolvedLevelData.level_number)
    .maybeSingle();

  const previousBest = typeof currentProgress?.best_score === "number" ? currentProgress.best_score : null;
  const incomingBest = isUngraded ? null : (typeof scorePercent === "number" ? Math.max(0, Math.min(100, Math.round(scorePercent))) : null);
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
        approval_status: currentProgress?.approval_status === "approved" ? "pending" : currentProgress?.approval_status ?? "pending",
        // Keep the completed level unlocked so students can revisit it after completion
        unlocked: true,
        best_score: bestScore,
        updated_at: now,
      },
      { onConflict: "user_id,level_number" },
    );

  const wasApproved = currentProgress?.approval_status === "approved";

  if (resolvedLevelData.level_number < 15) {
    await supabase
      .from("level_progress")
      .upsert(
        {
          user_id: userId,
          level_number: resolvedLevelData.level_number + 1,
          unlocked: wasApproved,
          updated_at: now,
        },
        { onConflict: "user_id,level_number" },
      );
  }

  if (!currentProgress?.completed && wasApproved) {
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

  // Notify the student's teacher(s) that the level is now awaiting approval.
  // Skip if the level was already approved (i.e. a re-submission of an approved level),
  // so we don't spam teachers with duplicate notifications.
  if (!wasApproved) {
    try {
      const { data: classRows } = await supabase
        .from("class_students")
        .select("classes(teacher_id)")
        .eq("student_id", userId)
        .eq("is_active", true);

      const teacherIds = new Set<string>();
      for (const row of classRows ?? []) {
        const classRef = (row as { classes?: { teacher_id?: string } | { teacher_id?: string }[] | null })
          .classes;
        const teacherId = Array.isArray(classRef) ? classRef[0]?.teacher_id : classRef?.teacher_id;
        if (typeof teacherId === "string" && teacherId.length > 0) {
          teacherIds.add(teacherId);
        }
      }

      if (teacherIds.size === 0) {
        return;
      }

      // Avoid inserting a duplicate unread notification for the same teacher + student + level.
      const { data: existing } = await supabase
        .from("teacher_notifications")
        .select("teacher_id")
        .eq("student_id", userId)
        .eq("level_id", levelId)
        .eq("type", "level_pending_approval")
        .eq("is_read", false)
        .in("teacher_id", Array.from(teacherIds));

      const alreadyNotified = new Set<string>(((existing ?? []) as Array<{ teacher_id: string }>).map((row) => row.teacher_id));
      const freshTeacherIds = Array.from(teacherIds).filter((teacherId) => !alreadyNotified.has(teacherId));

      if (freshTeacherIds.length === 0) {
        return;
      }

      const message = `Student completed Level ${resolvedLevelData.level_number} and is awaiting your approval to proceed.`;
      const notifications = freshTeacherIds.map((teacherId) => ({
        teacher_id: teacherId,
        student_id: userId,
        level_id: levelId,
        type: "level_pending_approval",
        message,
        is_read: false,
        created_at: now,
      }));

      await supabase.from("teacher_notifications").insert(notifications);
    } catch (notificationError) {
      // Never fail the outcome because the notification could not be created.
      console.error("Failed to create level_pending_approval notification", notificationError);
    }
  }
}
