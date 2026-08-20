import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeAttachment } from "@/lib/gemini/analyze-attachment";
import { updateCanonicalRenovationDna } from "@/lib/yoxa/tools/update-canonical-renovation-dna";

// POST /api/projects/:projectId/attachments/:attachmentId/process
// Called by AttachmentButton right after its own client-side upload +
// `attachments` row insert succeeds. Responds immediately once the caller
// and the attachment are confirmed to belong to each other; the actual
// Gemini vision/document pass runs in the background via after() so the
// upload UI never blocks on it. Realtime coverage on `evidence` (see
// 20260820000000_realtime_structured_dna_tables.sql) means whatever this
// writes shows up live on /understanding with no extra frontend work.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; attachmentId: string }> }
) {
  const { projectId, attachmentId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this project" }, { status: 403 });
  }

  const { data: attachment } = await supabase
    .from("attachments")
    .select("id, storage_path, mime_type, label, status")
    .eq("id", attachmentId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (attachment.status === "processed" || attachment.status === "processing") {
    return NextResponse.json({ status: attachment.status });
  }

  // Atomic claim: 'pending' or a previously-'failed' attachment can be
  // (re)processed, but only one caller wins — guards a fast double-click
  // on the retry button from running two Gemini passes and writing
  // duplicate evidence for the same file.
  const service = createServiceClient();
  const { data: claimed } = await service
    .from("attachments")
    .update({ status: "processing" })
    .eq("id", attachmentId)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ status: "processing" });
  }

  after(async () => {
    try {
      const { data: file, error: downloadError } = await service.storage
        .from("project-attachments")
        .download(attachment.storage_path);
      if (downloadError || !file) throw new Error(downloadError?.message ?? "download failed");

      const bytes = Buffer.from(await file.arrayBuffer());
      const result = await analyzeAttachment({
        bytes,
        mimeType: attachment.mime_type ?? "application/octet-stream",
        label: attachment.label ?? "attachment",
      });

      if (result.evidence.length > 0 || result.constraints.length > 0 || result.budgetLines.length > 0) {
        await updateCanonicalRenovationDna(service, projectId, {
          evidence: result.evidence,
          constraints: result.constraints,
          budgetLines: result.budgetLines,
        });
      }

      await service.from("attachments").update({ status: "processed" }).eq("id", attachmentId);
    } catch (err) {
      console.error("attachment processing failed", attachmentId, err);
      await service.from("attachments").update({ status: "failed" }).eq("id", attachmentId);
    }
  });

  return NextResponse.json({ status: "processing" }, { status: 202 });
}
