import { calculateActivityReward, calculateLevelCompletionReward, validateRewardBatch } from '../../src/lib/rewards'

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
})
