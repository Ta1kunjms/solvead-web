import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Params = {
  activityId: string;
};

const HTML_BUCKET = "activity-html";

type AccessResult = {
  allowed: boolean;
  error: string | null;
  statusCode: 404 | 500 | undefined;
};

async function verifyActivityAccess(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  activityId: string,
  userId: string | null,
): Promise<AccessResult> {
  const { data: activity } = await supabase
    .from("activities")
    .select("id, is_published, created_by, level_id")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity) {
    return { allowed: false, error: "Activity not found", statusCode: 404 };
  }

  if (activity.is_published) {
    return { allowed: true, error: null, statusCode: undefined };
  }

  if (userId && activity.created_by === userId) {
    return { allowed: true, error: null, statusCode: undefined };
  }

  return { allowed: false, error: "Activity not found", statusCode: 404 };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { activityId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { allowed, error, statusCode } = await verifyActivityAccess(supabase, activityId, user?.id ?? null);
  if (!allowed) {
    return NextResponse.json({ error }, { status: statusCode ?? 500 });
  }

  const filePath = `activities/${activityId}/activity.html`;

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(HTML_BUCKET)
    .download(filePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "HTML file not found" }, { status: 404 });
  }

  const htmlContent = await fileData.text();

  const response = new NextResponse(htmlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Frame-Options": "ALLOW-FROM *",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });

  return response;
}