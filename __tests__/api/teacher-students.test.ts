import * as studentsRoute from '../../src/app/api/teacher/students/route'

const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/lib/supabase/server', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

describe('teacher students api', () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it('returns the visible student directory', async () => {
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
      }),
      rpc: jest.fn().mockResolvedValue({
        data: [
          {
            student_id: 'student-1',
            first_name: 'Ava',
            last_name: 'Diaz',
            lrn: '123456',
            profile_icon: null,
            onboarding_complete: true,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    })

    const response = await studentsRoute.GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.total_visible_students).toBe(1)
    expect(body.students).toHaveLength(1)
    expect(body.students[0].first_name).toBe('Ava')
  })
})