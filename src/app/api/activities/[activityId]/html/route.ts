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

const createErrorHtml = (message: string, statusCode: number) => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .error-container { background: white; border-radius: 8px; padding: 40px; max-width: 500px; margin: 40px auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #dc2626; margin: 0 0 10px 0; }
    p { color: #6b7280; margin: 0; }
    .status-code { color: #9ca3af; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Activity Content Unavailable</h1>
    <p>${message}</p>
    <div class="status-code">Error ${statusCode}</div>
  </div>
</body>
</html>`;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return new NextResponse(createErrorHtml("Supabase is not configured", 500), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { activityId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { allowed, error, statusCode } = await verifyActivityAccess(supabase, activityId, user?.id ?? null);
  if (!allowed) {
    return new NextResponse(createErrorHtml(error || "Unknown error", statusCode ?? 500), {
      status: statusCode ?? 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const filePath = `activities/${activityId}/activity.html`;

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(HTML_BUCKET)
    .download(filePath);

  if (downloadError || !fileData) {
    return new NextResponse(
      createErrorHtml("The activity content file could not be found or accessed. Please contact your teacher.", 404),
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const htmlContent = await fileData.text();

  // Serve the activity HTML exactly as uploaded. Do NOT inject scripts via
  // string replace: H5P core JavaScript embeds literal HTML markup (including
  // "</head>") inside its own `document.write(...)` calls, and a naive
  // String.replace would inject our script tag INTO that JS string. The
  // resulting unbalanced `</script>` causes the browser to close the script
  // block early and render the rest of the H5P bundle as plain text. The
  // parent page captures xAPI events via direct contentWindow access on the
  // iframe (allow-same-origin) instead — see HtmlActivityFrame.tsx.
  const response = new NextResponse(htmlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Frame-Options": "ALLOW-FROM *",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });

  return response;
}