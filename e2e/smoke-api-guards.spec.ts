import { test, expect } from '@playwright/test'

test.describe('API guard smoke', () => {
  test('teacher APIs reject anonymous requests', async ({ request }) => {
    const checks: Array<{
      endpoint: string
      method: 'get' | 'post'
      data?: Record<string, unknown>
    }> = [
      { endpoint: '/api/teacher/classes', method: 'get' },
      { endpoint: '/api/teacher/classes/dummy', method: 'get' },
      { endpoint: '/api/teacher/content', method: 'get' },
      { endpoint: '/api/teacher/lessons/dummy', method: 'get' },
      { endpoint: '/api/teacher/reflections', method: 'get' },
      { endpoint: '/api/teacher/activities/dummy', method: 'get' },
      {
        endpoint: '/api/teacher/lessons',
        method: 'post',
        data: { level_id: 'dummy', title: 'dummy', is_published: false },
      },
      {
        endpoint: '/api/teacher/activities',
        method: 'post',
        data: {
          level_id: 'dummy',
          title: 'dummy',
          activity_type: 'quiz',
          passing_score: 70,
          is_required: true,
          is_published: false,
        },
      },
    ]

    for (const check of checks) {
      const response =
        check.method === 'get'
          ? await request.get(check.endpoint)
          : await request.post(check.endpoint, { data: check.data })

      expect([401, 403]).toContain(response.status())
    }
  })

  test('student reflection write rejects anonymous requests', async ({ request }) => {
    const response = await request.post('/api/student/reflections', {
      data: {
        promptId: '00000000-0000-0000-0000-000000000000',
        responseText: 'This should be blocked for anonymous users.',
      },
    })

    expect([401, 403]).toContain(response.status())
  })
})
