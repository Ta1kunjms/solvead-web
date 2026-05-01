import { NextRequest } from "next/server"
import * as screenshotRoute from "../../src/app/api/teacher/students/[studentId]/attempts/[attemptId]/screenshot/route"

const getSupabaseServerClientMock = jest.fn()

jest.mock("../../src/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

describe("teacher student screenshot preview api", () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset()
  })

  it("returns a signed preview url for a valid screenshot", async () => {
    getSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "teacher-1" } }, error: null }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === "app_user_roles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { role: "teacher" }, error: null }),
              }),
            }),
          }
        }

        if (table === "activity_attempts") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: "attempt-1",
                      student_id: "student-1",
                      screenshot_path: "student-1/activity-1/attempt-1.png",
                      screenshot_mime_type: "image/png",
                      screenshot_size_bytes: 12345,
                      screenshot_uploaded_at: "2024-01-03T00:00:01Z",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/signed" }, error: null }),
        }),
      },
    })

    const response = await screenshotRoute.GET(new NextRequest("http://localhost/"), {
      params: Promise.resolve({ studentId: "student-1", attemptId: "attempt-1" }),
    })

    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.preview_url).toBe("https://example.com/signed")
    expect(body.screenshot_available).toBe(true)
    expect(body.expires_in_seconds).toBe(60)
  })
})