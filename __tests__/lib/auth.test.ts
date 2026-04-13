import { isTeacher, isStudent, isAuthenticated, type AuthContext } from '../../src/lib/auth'

describe('Authorization', () => {
  describe('isTeacher', () => {
    it('should authorize teacher role', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'teacher',
        email: 'teacher@example.com',
      }
      const result = isTeacher(context)
      expect(result.authorized).toBe(true)
    })

    it('should authorize admin role as teacher', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'admin',
        email: 'admin@example.com',
      }
      const result = isTeacher(context)
      expect(result.authorized).toBe(true)
    })

    it('should reject student role', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'student',
        email: 'student@example.com',
      }
      const result = isTeacher(context)
      expect(result.authorized).toBe(false)
    })

    it('should reject null context', () => {
      const result = isTeacher(null)
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('not authenticated')
    })
  })

  describe('isStudent', () => {
    it('should authorize student role', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'student',
        email: 'student@example.com',
      }
      const result = isStudent(context)
      expect(result.authorized).toBe(true)
    })

    it('should reject teacher role', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'teacher',
        email: 'teacher@example.com',
      }
      const result = isStudent(context)
      expect(result.authorized).toBe(false)
    })

    it('should reject admin role', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'admin',
        email: 'admin@example.com',
      }
      const result = isStudent(context)
      expect(result.authorized).toBe(false)
    })

    it('should reject null context', () => {
      const result = isStudent(null)
      expect(result.authorized).toBe(false)
    })
  })

  describe('isAuthenticated', () => {
    it('should accept any authenticated user', () => {
      const context: AuthContext = {
        userId: '123',
        role: 'student',
        email: 'user@example.com',
      }
      const result = isAuthenticated(context)
      expect(result.authorized).toBe(true)
    })

    it('should reject null context', () => {
      const result = isAuthenticated(null)
      expect(result.authorized).toBe(false)
      expect(result.reason).toContain('not authenticated')
    })
  })
})
