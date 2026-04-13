import { NextRequest } from 'next/server'
import * as contentRoute from '../../src/app/api/teacher/content/route'
import * as classesRoute from '../../src/app/api/teacher/classes/route'
import * as lessonsRoute from '../../src/app/api/teacher/lessons/route'
import * as reflectionsRoute from '../../src/app/api/teacher/reflections/route'

const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/lib/supabase/server', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

type MockRole = 'teacher' | 'student' | null

function buildSupabaseMock(role: MockRole) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: role ? { role } : null,
    error: null,
  })

  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle,
  }

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: role ? { id: 'user-1' } : null },
        error: null,
      }),
    },
    from: jest.fn(() => chain),
  }
}

describe('teacher API guards', () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it('rejects anonymous teacher content requests', async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: jest.fn(),
    })

    const response = await contentRoute.GET()

    expect(response.status).toBe(401)
  })

  it('rejects student class creation requests', async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock('student'))

    const request = new NextRequest('http://localhost/api/teacher/classes', {
      method: 'POST',
      body: JSON.stringify({ class_name: 'Grade 7 A' }),
    })

    const response = await classesRoute.POST(request)

    expect(response.status).toBe(403)
  })

  it('rejects student lesson creation requests', async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock('student'))

    const request = new NextRequest('http://localhost/api/teacher/lessons', {
      method: 'POST',
      body: JSON.stringify({ level_id: 'level-1', title: 'Angles', is_published: false }),
    })

    const response = await lessonsRoute.POST(request)

    expect(response.status).toBe(403)
  })

  it('rejects anonymous reflection review requests', async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: jest.fn(),
    })

    const request = new NextRequest('http://localhost/api/teacher/reflections', {
      method: 'PATCH',
      body: JSON.stringify({ reflectionId: 'reflection-1', teacher_feedback: 'Good work' }),
    })

    const response = await reflectionsRoute.PATCH(request)

    expect(response.status).toBe(401)
  })

  it('rejects student reflection review requests', async () => {
    getSupabaseServerClientMock.mockResolvedValue(buildSupabaseMock('student'))

    const request = new NextRequest('http://localhost/api/teacher/reflections', {
      method: 'PATCH',
      body: JSON.stringify({ reflectionId: 'reflection-1', teacher_feedback: 'Good work' }),
    })

    const response = await reflectionsRoute.PATCH(request)

    expect(response.status).toBe(403)
  })
})