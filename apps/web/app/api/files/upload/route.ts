import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/auth";
import { attachmentsEnabled } from "@/lib/chat/config";

/**
 * POST /api/files/upload: store a chat attachment in Vercel Blob.
 * Off without BLOB_READ_WRITE_TOKEN; the chat hides the attach button then.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function error(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  if (!attachmentsEnabled()) {
    return error(501, "Attachments are off. Set BLOB_READ_WRITE_TOKEN to turn them on.");
  }
  const session = await getSession();
  if (!session) return error(401, "Not signed in.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error(400, "Send a multipart form with a `file` field.");
  if (file.size === 0) return error(400, "The file is empty.");
  if (file.size > MAX_BYTES) return error(400, "Files must be 5 MB or smaller.");
  if (!ALLOWED.has(file.type)) return error(400, "Use a JPEG, PNG, WebP, GIF or PDF file.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const key = `chat/${session.userId}/${nanoid(10)}-${safeName}`;

  try {
    const blob = await put(key, await file.arrayBuffer(), { access: "public", contentType: file.type });
    return Response.json({ url: blob.url, name: file.name, contentType: file.type });
  } catch (e) {
    console.error("[upload] blob put failed", e);
    return error(500, "Upload failed.");
  }
}
