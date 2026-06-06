import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Params = {
  activityId: string;
};

const HTML_BUCKET = "activity-html";

async function requireTeacher() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return { supabase: null, userId: null, error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: roleRecord } = await supabase.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle();

  if (roleRecord?.role !== "teacher") {
    return { supabase, userId: null, error: NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 }) };
  }

  return { supabase, userId: user.id, error: null };
}

async function verifyActivityAccess(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  activityId: string,
  userId: string,
) {
  const { data: activity } = await supabase
    .from("activities")
    .select("id, created_by")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity) {
    return false;
  }

  if (activity.created_by && activity.created_by !== userId) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher();
  if (auth.error) {
    return auth.error;
  }

  const { supabase, userId } = auth;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { activityId } = await params;

  if (!(await verifyActivityAccess(supabase, activityId, userId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  let payload: { path?: unknown; contentType?: unknown } = {};
  try {
    payload = (await request.json()) as { path?: unknown; contentType?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const path = typeof payload.path === "string" ? payload.path.trim() : "";
  const expectedPath = `activities/${activityId}/activity.html`;
  if (!path || path !== expectedPath) {
    return NextResponse.json({ error: "Resource path does not match this activity" }, { status: 400 });
  }

  const requestedContentType =
    typeof payload.contentType === "string" && payload.contentType.trim().length > 0
      ? payload.contentType.trim()
      : null;

  if (requestedContentType) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data: existing, error: readError } = await admin
        .from("storage.objects")
        .select("metadata")
        .eq("bucket_id", HTML_BUCKET)
        .eq("name", path)
        .maybeSingle();

      if (readError) {
        return NextResponse.json({ error: readError.message }, { status: 500 });
      }

      const previousMetadata =
        existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};

      const nextMetadata = { ...previousMetadata, mimetype: requestedContentType };

      const { error: metaError } = await admin
        .from("storage.objects")
        .update({ metadata: nextMetadata })
        .eq("bucket_id", HTML_BUCKET)
        .eq("name", path);

      if (metaError) {
        return NextResponse.json({ error: metaError.message }, { status: 500 });
      }
    }
  }

  const { data: publicUrlData } = supabase.storage.from(HTML_BUCKET).getPublicUrl(path);
  const htmlUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("activities")
    .update({ html_url: htmlUrl })
    .eq("id", activityId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ html_url: htmlUrl, path }, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher();
  if (auth.error) {
    return auth.error;
  }

  const { supabase, userId } = auth;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { activityId } = await params;

  if (!(await verifyActivityAccess(supabase, activityId, userId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const filePath = `activities/${activityId}/activity.html`;
  const { error: removeError } = await supabase.storage.from(HTML_BUCKET).remove([filePath]);

  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("activities")
    .update({ html_url: null })
    .eq("id", activityId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ html_url: null }, { status: 200 });
}
