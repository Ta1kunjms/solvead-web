import * as progressRoute from '../../src/app/api/teacher/students/[studentId]/progress/route'

const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/lib/supabase/server', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

describe('teacher student progress api', () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it('returns level progress for a student', async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } }, error: null }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null }),
          }),
        }),
      }).mockImplementation((table: string) => {
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
  })
})
