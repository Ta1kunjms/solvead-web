import { NextRequest } from "next/server"
import * as submitHtmlRoute from "../../src/app/api/activities/submit-html-result/route"
import { applyPassedActivityOutcome } from "../../src/lib/activity-outcomes"

const getSupabaseServerClientMock = jest.fn()

jest.mock("../../src/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

jest.mock("../../src/lib/activity-outcomes", () => ({
  applyPassedActivityOutcome: jest.fn(),
}))

const makePngFile = (name: string, byteLength = 16) => {
  const bytes = new Uint8Array(byteLength)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  return new File([bytes], name, { type: "image/png" })
}

const makeSupabase = () => {
  const activityLookupChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { id: "activity-1", level_id: "level-1", passing_score: 70 },
      error: null,
    }),
  }

  const existingAttemptChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
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
        ...existingAttemptChain,
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnValue(insertAttemptChain),
      }
    }

    if (table === "activity_attempt_answers") {
      return {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    }

    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
    }
  })

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "student-1" } }, error: null }),
    },
    from,
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }
}

describe("activities submit html result api", () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
    ;(applyPassedActivityOutcome as jest.Mock).mockReset()
  })

  it("returns a clear error when the screenshot is missing", async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "student-1" } }, error: null }),
      },
      from: jest.fn(),
      storage: { from: jest.fn() },
    })

    const formData = new FormData()
    formData.append("activity_id", "activity-1")
    formData.append("session_id", "session-1")
    formData.append("score", "80")
    formData.append("max_score", "100")

    const response = await submitHtmlRoute.POST(
      new NextRequest("http://localhost/api/activities/submit-html-result", {
        method: "POST",
        body: formData,
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Screenshot is required" })
  })

  it("rejects oversize screenshots", async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "student-1" } }, error: null }),
      },
      from: jest.fn(),
      storage: { from: jest.fn() },
    })

    const formData = new FormData()
    formData.append("activity_id", "activity-1")
    formData.append("session_id", "session-1")
    formData.append("score", "80")
    formData.append("max_score", "100")
    formData.append("screenshot", new File([new Uint8Array(8_388_609)], "shot.png", { type: "image/png" }))

    const response = await submitHtmlRoute.POST(
      new NextRequest("http://localhost/api/activities/submit-html-result", {
        method: "POST",
        body: formData,
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Screenshot must be 8MB or smaller" })
  })

  it("creates an attempt for a valid html result payload", async () => {
    getSupabaseServerClientMock.mockResolvedValue(makeSupabase())

    const formData = new FormData()
    formData.append("activity_id", "activity-1")
    formData.append("session_id", "session-1")
    formData.append("score", "65")
    formData.append("max_score", "100")
    formData.append("points", "65")
    formData.append("passed", "false")
    formData.append("screenshot", makePngFile("result.png"))

    const response = await submitHtmlRoute.POST(
      new NextRequest("http://localhost/api/activities/submit-html-result", {
        method: "POST",
        body: formData,
      }),
    )

    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.attempt_id).toBe("attempt-1")
    expect(body.passed).toBe(false)
    expect(body.score).toBe(65)
    expect(body.total_points).toBe(65)
    expect(applyPassedActivityOutcome).not.toHaveBeenCalled()
  })

  it("applies progression when screenshot submission succeeds and the result passes", async () => {
    getSupabaseServerClientMock.mockResolvedValue(makeSupabase())

    const formData = new FormData()
    formData.append("activity_id", "activity-1")
    formData.append("session_id", "session-2")
    formData.append("score", "100")
    formData.append("max_score", "100")
    formData.append("points", "100")
    formData.append("passed", "1")
    formData.append("screenshot", makePngFile("result.png"))

    const response = await submitHtmlRoute.POST(
      new NextRequest("http://localhost/api/activities/submit-html-result", {
        method: "POST",
        body: formData,
      }),
    )

    expect(response.status).toBe(200)
    expect(applyPassedActivityOutcome).toHaveBeenCalledTimes(1)
  })
})