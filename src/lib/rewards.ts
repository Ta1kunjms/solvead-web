/**
 * Reward Calculation Logic
 * Award points and stars based on activity/level completion
 */

export interface RewardBadge {
  id?: string
  code?: string
  name?: string
  description?: string | null
  icon?: string | null
}

export interface RewardBatch {
  points: number
  stars: number
  badges: string[]
  reason: string
}

export interface UserRewardRecord {
  id?: string
  user_id?: string
  level_id?: string | null
  badge_id?: string | null
  reward_type?: string | null
  points?: number | null
  stars?: number | null
  reason?: string | null
}

export interface UserRewardSummary {
  points: number
  stars: number
  badges: RewardBadge[]
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
 * Summarize flat user_rewards rows into the aggregate view the UI needs.
 * The database stores rows individually; badges are joined through badge_id.
 */
export function summarizeUserRewards(
  rewards: UserRewardRecord[] = [],
  badgeRows: Array<RewardBadge & { id: string; code?: string; name?: string; description?: string | null; icon?: string | null }> = [],
): UserRewardSummary {
  let totalPoints = 0
  let totalStars = 0
  const badgeMap = new Map<string, RewardBadge>()
  const seenBadgeIds = new Set<string>()

  for (const badge of badgeRows ?? []) {
    if (badge?.id) {
      badgeMap.set(badge.id, {
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description ?? null,
        icon: badge.icon ?? null,
      })
    }
  }

  const badgeList: RewardBadge[] = []

  for (const reward of rewards ?? []) {
    if (typeof reward?.points === 'number' && Number.isFinite(reward.points)) {
      totalPoints += reward.points
    }

    if (typeof reward?.stars === 'number' && Number.isFinite(reward.stars)) {
      totalStars += reward.stars
    }

    const badgeId = typeof reward?.badge_id === 'string' ? reward.badge_id : null
    if (!badgeId || seenBadgeIds.has(badgeId)) {
      continue
    }

    const matchedBadge = badgeMap.get(badgeId)
    if (!matchedBadge) {
      continue
    }

    seenBadgeIds.add(badgeId)
    badgeList.push(matchedBadge)
  }

  return {
    points: Math.max(0, totalPoints),
    stars: Math.max(0, totalStars),
    badges: badgeList,
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
