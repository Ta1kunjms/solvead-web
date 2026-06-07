import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AdmZip from "adm-zip";

type Params = {
  activityId: string;
};

const HTML_BUCKET = "activity-html";
const MAX_FILE_SIZE = 200_000_000;

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

async function cleanOldFiles(supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>, activityId: string) {
  const prefix = `activities/${activityId}`;
  await supabase.storage.from(HTML_BUCKET).remove([`${prefix}/activity.html`]).catch(() => {});

  const { data: assets } = await supabase.storage.from(HTML_BUCKET).list(`${prefix}/assets`);
  if (assets && assets.length > 0) {
    const assetPaths = assets.map((a) => `${prefix}/assets/${a.name}`);
    await supabase.storage.from(HTML_BUCKET).remove(assetPaths).catch(() => {});
  }
}

function findMainHtml(zip: AdmZip): { entry: AdmZip.IZipEntry; content: string } | null {
  const entries = zip.getEntries();
  let best: AdmZip.IZipEntry | null = null;

  for (const entry of entries) {
    if (!entry.isDirectory && /\.html?$/i.test(entry.name)) {
      if (!best || entry.entryName.split("/").length < best.entryName.split("/").length) {
        best = entry;
      }
    }
  }

  if (!best) return null;
  return { entry: best, content: best.getData().toString("utf-8") };
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
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 200MB" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".zip")) {
    await cleanOldFiles(supabase, activityId);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let zip: AdmZip;
    try {
      zip = new AdmZip(fileBuffer);
    } catch {
      return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
    }

    const mainHtml = findMainHtml(zip);
    if (!mainHtml) {
      return NextResponse.json({ error: "No HTML file found in ZIP" }, { status: 400 });
    }

    const htmlPath = `activities/${activityId}/activity.html`;
    const { error: htmlUploadError } = await supabase.storage
      .from(HTML_BUCKET)
      .upload(htmlPath, Buffer.from(mainHtml.content, "utf-8"), {
        contentType: "text/html; charset=utf-8",
        cacheControl: "no-cache",
        upsert: true,
      });

    if (htmlUploadError) {
      return NextResponse.json({ error: htmlUploadError.message }, { status: 500 });
    }

    const uploadPromises: Promise<unknown>[] = [];
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.entryName === mainHtml.entry.entryName) continue;

      const relativePath = entry.entryName;
      const assetPath = `activities/${activityId}/assets/${relativePath}`;
      const data = entry.getData();

      uploadPromises.push(
        supabase.storage.from(HTML_BUCKET).upload(assetPath, data, {
          contentType: getContentType(entry.name),
          cacheControl: "public, max-age=31536000, immutable",
          upsert: true,
        }),
      );
    }

    const results = await Promise.allSettled(uploadPromises);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`[upload-zip] ${failed.length} asset(s) failed to upload for activity ${activityId}`);
    }

    const { error: updateError } = await supabase
      .from("activities")
      .update({ html_url: `/api/activities/${activityId}/html` })
      .eq("id", activityId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      html_url: `/api/activities/${activityId}/html`,
      assets_uploaded: entries.length - 1,
      assets_failed: failed.length,
    }, { status: 200 });
  }

  if (!fileName.endsWith(".html") && !fileName.endsWith(".htm")) {
    return NextResponse.json({ error: "Only .html, .htm, or .zip files are supported" }, { status: 400 });
  }

  await cleanOldFiles(supabase, activityId);

  const htmlPath = `activities/${activityId}/activity.html`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(HTML_BUCKET)
    .upload(htmlPath, fileBuffer, {
      contentType: "text/html; charset=utf-8",
      cacheControl: "no-cache",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("activities")
    .update({ html_url: `/api/activities/${activityId}/html` })
    .eq("id", activityId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ html_url: `/api/activities/${activityId}/html` }, { status: 200 });
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

  await cleanOldFiles(supabase, activityId);

  const { error: updateError } = await supabase
    .from("activities")
    .update({ html_url: null })
    .eq("id", activityId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ html_url: null }, { status: 200 });
}

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
    txt: "text/plain",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return types[ext] ?? "application/octet-stream";
}
