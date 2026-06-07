import { NextRequest } from "next/server";
import * as htmlRoute from "../../src/app/api/activities/[activityId]/html/route";

const getSupabaseServerClientMock = jest.fn();

jest.mock("../../src/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}));

describe("api/activities/[activityId]/html route", () => {
  beforeEach(() => {
    getSupabaseServerClientMock.mockReset();
  });

  it("returns 404 when activity does not exist", async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    getSupabaseServerClientMock.mockResolvedValue(mockSupabase);

    const response = await htmlRoute.GET(
      new NextRequest("http://localhost/api/activities/nonexistent/html"),
      { params: Promise.resolve({ activityId: "nonexistent" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Activity not found" });
  });

  it("returns 404 when activity is not published and user is not the owner", async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "other-user" } }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "activity-1", is_published: false, created_by: "owner-user", level_id: "level-1" },
          error: null,
        }),
      }),
    };
    getSupabaseServerClientMock.mockResolvedValue(mockSupabase);

    const response = await htmlRoute.GET(
      new NextRequest("http://localhost/api/activities/activity-1/html"),
      { params: Promise.resolve({ activityId: "activity-1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns HTML for published activities without auth requirement", async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "activity-1", is_published: true, created_by: "owner-user", level_id: "level-1" },
          error: null,
        }),
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: new Blob(["<html><body>Test</body></html>"], { type: "text/html" }),
            error: null,
          }),
        }),
      },
    };
    getSupabaseServerClientMock.mockResolvedValue(mockSupabase);

    const response = await htmlRoute.GET(
      new NextRequest("http://localhost/api/activities/activity-1/html"),
      { params: Promise.resolve({ activityId: "activity-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  it("returns HTML for unpublished activities when user is the owner", async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "owner-user" } }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "activity-1", is_published: false, created_by: "owner-user", level_id: "level-1" },
          error: null,
        }),
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: new Blob(["<html><body>Test</body></html>"], { type: "text/html" }),
            error: null,
          }),
        }),
      },
    };
    getSupabaseServerClientMock.mockResolvedValue(mockSupabase);

    const response = await htmlRoute.GET(
      new NextRequest("http://localhost/api/activities/activity-1/html"),
      { params: Promise.resolve({ activityId: "activity-1" }) },
    );

    expect(response.status).toBe(200);
  });

  it("returns 404 when HTML file does not exist", async () => {
    const mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "activity-1", is_published: true, created_by: "owner-user", level_id: "level-1" },
          error: null,
        }),
      }),
      storage: {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      },
    };
    getSupabaseServerClientMock.mockResolvedValue(mockSupabase);

    const response = await htmlRoute.GET(
      new NextRequest("http://localhost/api/activities/activity-1/html"),
      { params: Promise.resolve({ activityId: "activity-1" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "HTML file not found" });
  });
});