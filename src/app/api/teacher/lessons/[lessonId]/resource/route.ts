import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Params = {
  lessonId: string;
};

const RESOURCE_BUCKET = "lesson-resources";
const MAX_RESOURCE_SIZE = 200_000_000;
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

function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  if (index === -1) {
    return "";
  }

  return fileName.slice(index).toLowerCase();
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Resource file is required" }, { status: 400 });
  }

  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Resource file is empty" }, { status: 400 });
  }

  if (file.size > MAX_RESOURCE_SIZE) {
    return NextResponse.json({ error: "Resource file exceeds 200MB" }, { status: 400 });
  }

  const filePath = `lessons/${lessonId}/resource${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  let uploadResult;
  try {
    uploadResult = await supabase.storage
      .from(RESOURCE_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        cacheControl: "3600",
        upsert: true,
      });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Storage upload failed" },
      { status: 500 },
    );
  }

  const { error: uploadError } = uploadResult;
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(RESOURCE_BUCKET).getPublicUrl(filePath);
  const resourceUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("lessons")
    .update({ ppt_url: resourceUrl })
    .eq("id", lessonId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ppt_url: resourceUrl }, { status: 200 });
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
