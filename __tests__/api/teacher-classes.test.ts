import * as classesRoute from '../../src/app/api/teacher/classes/route'

const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/lib/supabase/server', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

const buildQuery = (data: unknown, error: { message: string } | null = null) => {
  const chain: {
    select: jest.Mock
    eq: jest.Mock
    order: jest.Mock
    maybeSingle: jest.Mock
    then: (resolve: (value: QueryResult) => void) => Promise<void>
  } = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({ data, error })),
    then: (resolve) => Promise.resolve(resolve({ data, error })),
  }

  return chain
}

describe('teacher classes api', () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it('returns total_visible_students and merged summaries', async () => {
    const classes = [
      {
        id: 'class-1',
        teacher_id: 'teacher-1',
        class_name: 'Grade 7',
        section: null,
        grade_level: null,
        archived: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    const summaries = [
      {
        class_id: 'class-1',
        student_count: 3,
        average_best_score: 80,
        last_progress_at: null,
      },
    ]

    const from = jest.fn((table: string) => {
      if (table === 'app_user_roles') {
        return buildQuery({ role: 'teacher' })
      }
      if (table === 'classes') {
        return buildQuery(classes)
      }
      if (table === 'teacher_class_progress_summary') {
        return buildQuery(summaries)
      }
      return buildQuery([])
    })

    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } }, error: null }),
      },
      from,
      rpc: jest.fn().mockResolvedValue({ data: [{ student_id: 's1' }, { student_id: 's2' }], error: null }),
    })

    const response = await classesRoute.GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.total_visible_students).toBe(2)
    expect(body.classes).toHaveLength(1)
    expect(body.classes[0].student_count).toBe(3)
    expect(body.classes[0].average_best_score).toBe(80)
  })
})
