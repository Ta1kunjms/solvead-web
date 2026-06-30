import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

type Params = {
  activityId: string;
};

const HTML_BUCKET = "activity-html";
const MAX_FILE_SIZE = 200_000_000;
const ALLOWED_TYPES = ["text/html", "application/zip", "application/x-zip-compressed"];

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
) {
  const { data: activity } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .maybeSingle();

  return !!activity;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher();
  if (auth.error) return auth.error;

  const { supabase } = auth;
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { activityId } = await params;

  if (!(await verifyActivityAccess(supabase, activityId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  let body: { fileName?: string; fileSize?: number; fileType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fileName, fileSize, fileType } = body;

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
    return NextResponse.json({ error: "fileSize must be a positive number" }, { status: 400 });
  }

  if (!fileType || typeof fileType !== "string" || !ALLOWED_TYPES.includes(fileType)) {
    return NextResponse.json({ error: "Unsupported file type. Must be text/html or application/zip." }, { status: 400 });
  }

  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 200MB limit" }, { status: 400 });
  }

  const uniqueId = randomUUID();
  const storagePath = `activities/${activityId}/${uniqueId}-${fileName}`;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const { data, error } = await admin.storage
    .from(HTML_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    presignedUrl: data.signedUrl,
    storagePath: data.path,
    token: data.token,
  }, { status: 200 });
}
