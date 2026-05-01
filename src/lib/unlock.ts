/**
 * Unlock Rule Logic
 * Student unlocks next level when they pass 70% of all required activities in current level
 */

export interface ActivityAttempt {
  activity_id: string
  passed: boolean
  score: number
}

export interface LevelActivity {
  id: string
  is_required: boolean
}

export interface UnlockCheckResult {
  unlocked: boolean
  reason: string
  passedActivities: number
  requiredActivities: number
  approval_status?: "pending" | "approved" | "denied"
}

/**
 * Check if student should unlock next level
 * Rule: All required activities in current level must be passed at 70%+
 */
export function shouldUnlockNextLevel(
  attempts: ActivityAttempt[],
  activities: LevelActivity[]
): UnlockCheckResult {
  const requiredActivities = activities.filter(a => a.is_required)
  const passedRequired = requiredActivities.filter(activity => {
    const attempt = attempts.find(a => a.activity_id === activity.id)
    return attempt && attempt.passed
  })

  const unlocked = passedRequired.length === requiredActivities.length && requiredActivities.length > 0

  return {
    unlocked,
    reason: unlocked
      ? `Student passed all ${requiredActivities.length} required activities`
      : `Student passed ${passedRequired.length}/${requiredActivities.length} required activities`,
    passedActivities: passedRequired.length,
    requiredActivities: requiredActivities.length,
  }
}

/**
 * Calculate if activity pass/fail based on score and passing_score threshold
 */
export function calculateActivityPass(
  score: number,
  passingScore: number
): boolean {
  return score >= passingScore
}
