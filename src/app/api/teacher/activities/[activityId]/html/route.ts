import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Params = {
  activityId: string;
};

const HTML_BUCKET = "activity-html";
const MAX_HTML_SIZE = 200_000_000;

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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "HTML file is required" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".html") && !fileName.endsWith(".htm")) {
    return NextResponse.json({ error: "Only .html files are supported" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "HTML file is empty" }, { status: 400 });
  }

  if (file.size > MAX_HTML_SIZE) {
    return NextResponse.json({ error: "HTML file exceeds 200MB" }, { status: 400 });
  }

  const filePath = `activities/${activityId}/activity.html`;

  await supabase.storage.from(HTML_BUCKET).remove([filePath]);

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(HTML_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: "text/html; charset=utf-8",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(HTML_BUCKET).getPublicUrl(filePath);
  const htmlUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("activities")
    .update({ html_url: htmlUrl })
    .eq("id", activityId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ html_url: htmlUrl }, { status: 200 });
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
