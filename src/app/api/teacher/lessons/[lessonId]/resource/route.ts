import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Params = {
  lessonId: string;
};

const RESOURCE_BUCKET = "lesson-resources";
const ALLOWED_EXTENSIONS = new Set([
  ".ppt",
  ".pptx",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".zip",
  ".h5p",
  ".lumi",
]);

function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return fileName.slice(index).toLowerCase();
}

function expectedResourcePath(lessonId: string) {
  return `lessons/${lessonId}/resource`;
}

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

  const { data: roleRecord } = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleRecord?.role !== "teacher") {
    return { supabase, userId: null, error: NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 }) };
  }

  return { supabase, userId: user.id, error: null };
}

async function verifyLessonAccess(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  lessonId: string,
) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .maybeSingle();

  return Boolean(lesson);
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher();
  if (auth.error) {
    return auth.error;
  }

  const { supabase } = auth;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { lessonId } = await params;

  if (!(await verifyLessonAccess(supabase, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  let payload: { path?: unknown; contentType?: unknown } = {};
  try {
    payload = (await request.json()) as { path?: unknown; contentType?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const path = typeof payload.path === "string" ? payload.path.trim() : "";
  if (!path) {
    return NextResponse.json({ error: "Resource path is required" }, { status: 400 });
  }

  const expectedPrefix = expectedResourcePath(lessonId);
  if (!path.startsWith(`${expectedPrefix}.`)) {
    return NextResponse.json({ error: "Resource path does not match this lesson" }, { status: 400 });
  }

  const extension = getExtension(path);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
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
        .eq("bucket_id", RESOURCE_BUCKET)
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
        .eq("bucket_id", RESOURCE_BUCKET)
        .eq("name", path);

      if (metaError) {
        return NextResponse.json({ error: metaError.message }, { status: 500 });
      }
    }
  }

  const { data: publicUrlData } = supabase.storage.from(RESOURCE_BUCKET).getPublicUrl(path);
  const resourceUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("lessons")
    .update({ ppt_url: resourceUrl })
    .eq("id", lessonId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ppt_url: resourceUrl, path }, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher();
  if (auth.error) {
    return auth.error;
  }

  const { supabase } = auth;
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { lessonId } = await params;

  if (!(await verifyLessonAccess(supabase, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const filePathPrefix = `lessons/${lessonId}/resource`;
  const { data: files, error: listError } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .list(`lessons/${lessonId}`, { limit: 20 });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const targets = (files || [])
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("resource"))
    .map((name) => `${filePathPrefix}${name.slice("resource".length)}`);

  if (targets.length > 0) {
    const { error: removeError } = await supabase.storage.from(RESOURCE_BUCKET).remove(targets);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase.from("lessons").update({ ppt_url: null }).eq("id", lessonId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ppt_url: null }, { status: 200 });
}
