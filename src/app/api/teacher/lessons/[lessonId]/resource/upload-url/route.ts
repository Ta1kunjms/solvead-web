import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { lessonId } = await params;

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleRecord } = await supabase
    .from("app_user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleRecord?.role !== "teacher") {
    return NextResponse.json({ error: "Forbidden: Teachers only" }, { status: 403 });
  }

  const fileName = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!fileName) {
    return NextResponse.json({ error: "Missing 'name' query parameter" }, { status: 400 });
  }

  const extension = getExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const path = `lessons/${lessonId}/resource${extension}`;

  const { data, error } = await admin.storage
    .from(RESOURCE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      bucket: RESOURCE_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    },
    { status: 200 },
  );
}
