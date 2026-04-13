/**
 * Reward Calculation Logic
 * Award points and stars based on activity/level completion
 */

export interface RewardBatch {
  points: number
  stars: number
  badges: string[]
  reason: string
}

const POINTS_PER_ACTIVITY = 10
const STARS_PER_LEVEL = 1

/**
 * Calculate rewards for activity pass
 */
export function calculateActivityReward(): RewardBatch {
  return {
    points: POINTS_PER_ACTIVITY,
    stars: 0,
    badges: [],
    reason: `Activity completed: +${POINTS_PER_ACTIVITY} points`,
  }
}

/**
 * Calculate rewards for level completion (all activities passed)
 */
export function calculateLevelCompletionReward(
  levelNumber: number,
  isFirstCompletion: boolean
): RewardBatch {
  const badges: string[] = []

  // Award "first-clear" badge on level 1 completion
  if (levelNumber === 1 && isFirstCompletion) {
    badges.push('first-clear')
  }

  return {
    points: 0,
    stars: STARS_PER_LEVEL,
    badges,
    reason: `Level ${levelNumber} completed${isFirstCompletion && levelNumber === 1 ? ' (first time)' : ''}: +${STARS_PER_LEVEL} star`,
  }
}

/**
 * Validate reward amounts (safety check)
 */
export function validateRewardBatch(batch: RewardBatch): boolean {
  return (
    batch.points >= 0 &&
    batch.points <= 1000 && // max points per transaction
    batch.stars >= 0 &&
    batch.stars <= 10 && // max stars per transaction
    batch.badges.length <= 3 && // max badges per transaction
    Array.isArray(batch.badges) &&
    batch.badges.every(b => typeof b === 'string')
  )
}
