/**
 * Authorization & Role Checking
 */

export type UserRole = 'student' | 'teacher' | 'admin'

export interface AuthContext {
  userId: string
  role: UserRole
  email: string
}

export interface AuthorizationResult {
  authorized: boolean
  reason: string
}

/**
 * Check if user is authorized as teacher
 */
export function isTeacher(context: AuthContext | null): AuthorizationResult {
  if (!context) {
    return {
      authorized: false,
      reason: 'User not authenticated',
    }
  }

  if (context.role === 'teacher' || context.role === 'admin') {
    return {
      authorized: true,
      reason: `User is ${context.role}`,
    }
  }

  return {
    authorized: false,
    reason: `User is ${context.role}, not teacher`,
  }
}

/**
 * Check if user is authorized as student
 */
export function isStudent(context: AuthContext | null): AuthorizationResult {
  if (!context) {
    return {
      authorized: false,
      reason: 'User not authenticated',
    }
  }

  if (context.role === 'student') {
    return {
      authorized: true,
      reason: 'User is student',
    }
  }

  return {
    authorized: false,
    reason: `User is ${context.role}, not student`,
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(context: AuthContext | null): AuthorizationResult {
  if (!context) {
    return {
      authorized: false,
      reason: 'User not authenticated',
    }
  }

  return {
    authorized: true,
    reason: `User ${context.userId} authenticated as ${context.role}`,
  }
}
