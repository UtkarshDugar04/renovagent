import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Shared by every tool that receives an image reference from a Yoxa Output
// Tool: Image call. Yoxa's own image is never linked to directly — the
// bytes are fetched here and re-uploaded into our own private bucket, so
// every generated image ends up behind the same private-bucket +
// signed-URL access model as everything else in the app, and the DB never
// depends on a Yoxa-origin URL staying valid.
export async function fetchAndStoreImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bucket: string,
  pathPrefix: string,
  imageUrl: string
): Promise<{ storagePath: string }> {
  // Yoxa's Output Tool: Image hands agents a same-origin path (e.g.
  // "/api/v1/workflow-runs/.../download"), not a full URL — resolve it
  // against Yoxa's own domain rather than assuming it's already absolute.
  let resolvedUrl: string;
  try {
    resolvedUrl = new URL(imageUrl, "https://yoxa.ai").toString();
  } catch {
    throw new ToolError(400, `Could not parse the provided image URL: "${imageUrl}"`);
  }

  let response: Response;
  try {
    response = await fetch(resolvedUrl);
  } catch (err) {
    throw new ToolError(502, `Could not reach the provided image URL: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!response.ok) {
    throw new ToolError(502, `Image URL returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!contentType.startsWith("image/")) {
    throw new ToolError(400, `Expected an image response, got content-type "${contentType || "unknown"}"`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new ToolError(400, "Image response was empty");
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ToolError(400, `Image is ${Math.round(bytes.length / 1024 / 1024)}MB, over the ${MAX_IMAGE_BYTES / 1024 / 1024}MB limit`);
  }

  const extension = EXTENSION_BY_MIME[contentType] ?? "png";
  const storagePath = `${pathPrefix}${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType });
  if (error) throw new ToolError(500, `Failed to store generated image: ${error.message}`);

  return { storagePath };
}
