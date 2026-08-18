import {
  calculateActivityReward,
  calculateLevelCompletionReward,
  summarizeUserRewards,
  validateRewardBatch,
} from '../../src/lib/rewards'

describe('Reward Calculation', () => {
  describe('calculateActivityReward', () => {
    it('should award 10 points per activity', () => {
      const reward = calculateActivityReward()
      expect(reward.points).toBe(10)
      expect(reward.stars).toBe(0)
    })

    it('should not award badges for activity completion', () => {
      const reward = calculateActivityReward()
      expect(reward.badges).toEqual([])
    })

    it('should include descriptive reason', () => {
      const reward = calculateActivityReward()
      expect(reward.reason).toContain('Activity completed')
      expect(reward.reason).toContain('+10 points')
    })
  })

  describe('calculateLevelCompletionReward', () => {
    it('should award 1 star per level completion', () => {
      const reward = calculateLevelCompletionReward(1, true)
      expect(reward.stars).toBe(1)
      expect(reward.points).toBe(0)
    })

    it('should award first-clear badge on level 1 completion', () => {
      const reward = calculateLevelCompletionReward(1, true)
      expect(reward.badges).toContain('first-clear')
    })

    it('should NOT award first-clear badge on level 2+', () => {
      const reward = calculateLevelCompletionReward(2, true)
      expect(reward.badges).not.toContain('first-clear')
    })

    it('should NOT award first-clear badge if not first completion', () => {
      const reward = calculateLevelCompletionReward(1, false)
      expect(reward.badges).not.toContain('first-clear')
    })

    it('should still award star on non-first completion', () => {
      const reward = calculateLevelCompletionReward(5, false)
      expect(reward.stars).toBe(1)
    })
  })

  describe('validateRewardBatch', () => {
    it('should validate a normal reward batch', () => {
      const batch = {
        points: 10,
        stars: 1,
        badges: ['first-clear'],
        reason: 'Test',
      }
      expect(validateRewardBatch(batch)).toBe(true)
    })

    it('should reject negative points', () => {
      const batch = {
        points: -10,
        stars: 0,
        badges: [],
        reason: 'Test',
      }
      expect(validateRewardBatch(batch)).toBe(false)
    })

    it('should reject points exceeding max', () => {
      const batch = {
        points: 1001,
        stars: 0,
        badges: [],
        reason: 'Test',
      }
      expect(validateRewardBatch(batch)).toBe(false)
    })

    it('should reject more than 3 badges', () => {
      const batch = {
        points: 0,
        stars: 0,
        badges: ['a', 'b', 'c', 'd'],
        reason: 'Test',
      }
      expect(validateRewardBatch(batch)).toBe(false)
    })

    it('should reject invalid badge types', () => {
      const batch = {
        points: 0,
        stars: 0,
        badges: ['valid', 123 as unknown as string],
        reason: 'Test',
      }
      expect(validateRewardBatch(batch)).toBe(false)
    })

    it('should accept zero rewards', () => {
      const batch = {
        points: 0,
        stars: 0,
        badges: [],
        reason: 'Test',
      }
      expect(validateRewardBatch(batch)).toBe(true)
    })
  })

  describe('summarizeUserRewards', () => {
    it('should aggregate flat-row user rewards into points, stars, and badge metadata', () => {
      const summary = summarizeUserRewards([
        { points: 25, stars: 0, badge_id: null, reason: 'Activity', reward_type: 'points' },
        { points: 10, stars: 0, badge_id: null, reason: 'Activity', reward_type: 'points' },
        { points: 0, stars: 1, badge_id: null, reason: 'Level 1', reward_type: 'star' },
        { points: 0, stars: 0, badge_id: 'badge-1', reason: 'Badge earned', reward_type: 'badge' },
      ], [
        { id: 'badge-1', code: 'first-clear', name: 'First Clear', description: 'Completed level 1', icon: '🏆' },
      ])

      expect(summary.points).toBe(35)
      expect(summary.stars).toBe(1)
      expect(summary.badges).toHaveLength(1)
      expect(summary.badges[0].code).toBe('first-clear')
      expect(summary.badges[0].name).toBe('First Clear')
    })

    it('should handle partial reward rows without crashing', () => {
      const summary = summarizeUserRewards([
        { points: 15, stars: 0, badge_id: null, reason: 'Partial reward', reward_type: 'points' },
      ], [])

      expect(summary.points).toBe(15)
      expect(summary.stars).toBe(0)
      expect(summary.badges).toEqual([])
    })
  })
})
