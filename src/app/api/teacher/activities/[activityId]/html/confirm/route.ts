import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AdmZip from "adm-zip";

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
    .select("id")
    .eq("id", activityId)
    .maybeSingle();

  return !!activity;
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

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireTeacher();
  if (auth.error) return auth.error;

  const { supabase, userId } = auth;
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { activityId } = await params;

  if (!(await verifyActivityAccess(supabase, activityId, userId))) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  let body: { storagePath?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { storagePath } = body;
  if (!storagePath || typeof storagePath !== "string") {
    return NextResponse.json({ error: "storagePath is required" }, { status: 400 });
  }

  const { data: exists } = await supabase.storage
    .from(HTML_BUCKET)
    .exists(storagePath);

  if (!exists) {
    return NextResponse.json({ error: "Uploaded file not found in storage" }, { status: 404 });
  }

  const fileName = storagePath.split("/").pop()?.toLowerCase() ?? "";

  await cleanOldFiles(supabase, activityId);

  if (fileName.endsWith(".zip")) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(HTML_BUCKET)
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Failed to download ZIP from storage" }, { status: 500 });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
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
      console.error(`[confirm-zip] ${failed.length} asset(s) failed to upload for activity ${activityId}`);
    }

    await supabase.storage.from(HTML_BUCKET).remove([storagePath]).catch(() => {});

    const { error: updateError } = await supabase
      .from("activities")
      .update({ html_url: `/api/activities/${activityId}/html` })
      .eq("id", activityId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      htmlUrl: `/api/activities/${activityId}/html`,
    }, { status: 200 });
  }

  if (!fileName.endsWith(".html") && !fileName.endsWith(".htm")) {
    return NextResponse.json({ error: "Only .html, .htm, or .zip files are supported" }, { status: 400 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(HTML_BUCKET)
    .download(storagePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Failed to download file from storage" }, { status: 500 });
  }

  const htmlPath = `activities/${activityId}/activity.html`;
  const fileBuffer = Buffer.from(await fileData.arrayBuffer());

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

  await supabase.storage.from(HTML_BUCKET).remove([storagePath]).catch(() => {});

  const { error: updateError } = await supabase
    .from("activities")
    .update({ html_url: `/api/activities/${activityId}/html` })
    .eq("id", activityId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    htmlUrl: `/api/activities/${activityId}/html`,
  }, { status: 200 });
}
