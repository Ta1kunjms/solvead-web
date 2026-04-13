import { NextRequest } from 'next/server'
import * as itemsRoute from '../../src/app/api/teacher/activities/[activityId]/items/route'

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

describe('teacher activity items api', () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  const buildSupabaseMock = () => {
    const from = jest.fn((table: string) => {
      if (table === 'app_user_roles') {
        return buildQuery({ role: 'teacher' })
      }
      if (table === 'activities') {
        return buildQuery({ id: 'activity-1', created_by: 'teacher-1' })
      }
      return buildQuery([])
    })

    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } }, error: null }),
      },
      from,
    }
  }

  it('rejects missing prompt on create', async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock())

    const request = new NextRequest('http://localhost/api/teacher/activities/activity-1/items', {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }),
    })

    const response = await itemsRoute.POST(request, { params: Promise.resolve({ activityId: 'activity-1' }) })
    expect(response.status).toBe(400)
  })

  it('rejects missing itemId on update', async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock())

    const request = new NextRequest('http://localhost/api/teacher/activities/activity-1/items', {
      method: 'PATCH',
      body: JSON.stringify({ prompt: 'Update prompt' }),
    })

    const response = await itemsRoute.PATCH(request, { params: Promise.resolve({ activityId: 'activity-1' }) })
    expect(response.status).toBe(400)
  })
})
