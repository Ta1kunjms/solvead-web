import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Params = {
  activityId: string;
  path: string[];
};

const HTML_BUCKET = "activity-html";

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { activityId, path } = await params;

  const filePath = `activities/${activityId}/assets/${path.join("/")}`;

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(HTML_BUCKET)
    .download(filePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const contentType = getContentType(path[path.length - 1]);

  return new NextResponse(fileData, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
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
