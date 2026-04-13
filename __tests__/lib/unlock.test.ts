import { shouldUnlockNextLevel, calculateActivityPass } from '../../src/lib/unlock'

describe('Unlock Logic', () => {
  describe('shouldUnlockNextLevel', () => {
    it('should unlock when all required activities are passed', () => {
      const attempts = [
        { activity_id: 'act1', passed: true, score: 80 },
        { activity_id: 'act2', passed: true, score: 75 },
      ]
      const activities = [
        { id: 'act1', is_required: true },
        { id: 'act2', is_required: true },
      ]

      const result = shouldUnlockNextLevel(attempts, activities)
      expect(result.unlocked).toBe(true)
      expect(result.passedActivities).toBe(2)
      expect(result.requiredActivities).toBe(2)
    })

    it('should NOT unlock when some required activities are not passed', () => {
      const attempts = [
        { activity_id: 'act1', passed: true, score: 80 },
        { activity_id: 'act2', passed: false, score: 60 },
      ]
      const activities = [
        { id: 'act1', is_required: true },
        { id: 'act2', is_required: true },
      ]

      const result = shouldUnlockNextLevel(attempts, activities)
      expect(result.unlocked).toBe(false)
      expect(result.passedActivities).toBe(1)
      expect(result.requiredActivities).toBe(2)
    })

    it('should ignore optional activities when determining unlock', () => {
      const attempts = [
        { activity_id: 'act1', passed: true, score: 80 },
        { activity_id: 'act2', passed: false, score: 40 }, // optional, failed
      ]
      const activities = [
        { id: 'act1', is_required: true },
        { id: 'act2', is_required: false },
      ]

      const result = shouldUnlockNextLevel(attempts, activities)
      expect(result.unlocked).toBe(true)
      expect(result.passedActivities).toBe(1)
      expect(result.requiredActivities).toBe(1)
    })

    it('should NOT unlock when no activities exist', () => {
      const attempts: ActivityAttempt[] = []
      const activities: LevelActivity[] = []

      const result = shouldUnlockNextLevel(attempts, activities)
      expect(result.unlocked).toBe(false)
      expect(result.requiredActivities).toBe(0)
    })

    it('should handle missing attempts gracefully', () => {
      const attempts: ActivityAttempt[] = []
      const activities: LevelActivity[] = [
        { id: 'act1', is_required: true },
        { id: 'act2', is_required: true },
      ]

      const result = shouldUnlockNextLevel(attempts, activities)
      expect(result.unlocked).toBe(false)
      expect(result.passedActivities).toBe(0)
      expect(result.requiredActivities).toBe(2)
    })
  })

  describe('calculateActivityPass', () => {
    it('should pass when score meets threshold', () => {
      expect(calculateActivityPass(75, 70)).toBe(true)
      expect(calculateActivityPass(70, 70)).toBe(true)
    })

    it('should fail when score below threshold', () => {
      expect(calculateActivityPass(69, 70)).toBe(false)
      expect(calculateActivityPass(50, 70)).toBe(false)
    })

    it('should handle edge case at exactly passing score', () => {
      expect(calculateActivityPass(70, 70)).toBe(true)
      expect(calculateActivityPass(69.99, 70)).toBe(false)
    })
  })
})
