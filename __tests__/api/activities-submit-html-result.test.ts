import { NextRequest } from "next/server"
import * as submitHtmlRoute from "../../src/app/api/activities/submit-html-result/route"

const getSupabaseServerClientMock = jest.fn()

jest.mock("../../src/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

describe("activities submit html result api", () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it("returns unauthorized when user is missing", async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    const request = new NextRequest("http://localhost/api/activities/submit-html-result", {
      method: "POST",
      body: JSON.stringify({
        activity_id: "activity-1",
        session_id: "session-1",
        score: 80,
        max_score: 100,
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await submitHtmlRoute.POST(request)
    expect(response.status).toBe(401)
  })

  it("creates an attempt for valid html result payload", async () => {
    const activityLookupChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: "activity-1", level_id: "level-1", passing_score: 70 },
        error: null,
      }),
    }

    const duplicateLookupChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    const insertAttemptChain = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "attempt-1" }, error: null }),
    }

    const from = jest.fn((table: string) => {
      if (table === "activities") {
        return activityLookupChain
      }

      if (table === "activity_attempts") {
        return {
          ...duplicateLookupChain,
          insert: jest.fn().mockReturnValue(insertAttemptChain),
        }
      }

      return {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "student-1" } }, error: null }),
      },
      from,
    })

    const request = new NextRequest("http://localhost/api/activities/submit-html-result", {
      method: "POST",
      body: JSON.stringify({
        activity_id: "activity-1",
        session_id: "session-1",
        score: 65,
        max_score: 100,
        points: 65,
        passed: false,
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await submitHtmlRoute.POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.attempt_id).toBe("attempt-1")
    expect(body.duplicate).toBe(false)
    expect(body.passed).toBe(false)
    expect(body.score).toBe(65)
    expect(body.total_points).toBe(65)
  })
})
