import * as progressRoute from '../../src/app/api/teacher/students/[studentId]/progress/route'

const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/lib/supabase/server', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

describe('teacher student progress api', () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it('returns level progress and screenshot metadata for a student', async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } }, error: null }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'app_user_roles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'level_progress') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    { level_number: 1, completed: true, best_score: 95 },
                    { level_number: 2, completed: true, best_score: 87 },
                    { level_number: 3, completed: false, best_score: null },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'activity_attempts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'attempt-1',
                      activity_id: 'act-1',
                      submitted_at: '2024-01-03T00:00:00Z',
                      score: 80,
                      max_score: 100,
                      passed: true,
                      screenshot_path: 'student-1/act-1/attempt-1.png',
                      screenshot_mime_type: 'image/png',
                      screenshot_size_bytes: 12345,
                      screenshot_uploaded_at: '2024-01-03T00:00:01Z',
                      activities: [{ title: 'Angles' }],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }),
    })

    const params = Promise.resolve({ studentId: 'student-1' })
    const response = await progressRoute.GET(new Request('http://localhost/'), { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.progress).toHaveLength(3)
    expect(body.progress[0].level_number).toBe(1)
    expect(body.progress[0].completed).toBe(true)
    expect(body.progress[0].best_score).toBe(95)
    expect(body.attempts).toHaveLength(1)
    expect(body.attempts[0].screenshot.available).toBe(true)
    expect(body.attempts[0].screenshot.mime_type).toBe('image/png')
  })
})