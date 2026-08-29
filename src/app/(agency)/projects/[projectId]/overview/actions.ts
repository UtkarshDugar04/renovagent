"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateConversationBrief } from "@/lib/groq/generate-brief";
import { markdownToPdf } from "@/lib/gemini/markdown-to-pdf";

// Backfill for projects sent to Yoxa before send-to-yoxa.ts started storing
// the brief PDF — that upload was deliberately non-fatal, so any project
// sent before that point has a workflow_runs row but no stored PDF, and
// the download link on this page just doesn't render (see overview's
// page.tsx). This regenerates the exact same document from current
// message history and stores it at the same path, so the link appears on
// the next load — same generation path send-to-yoxa.ts uses, just
// triggered on demand instead of at send time.
export async function backfillConversationBrief(projectId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const brief = await generateConversationBrief(supabase, projectId);
  const briefPdf = await markdownToPdf(brief.markdown);

  const { error: uploadError } = await supabase.storage
    .from("project-attachments")
    .upload(`${projectId}/conversation-brief.pdf`, briefPdf, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  revalidatePath(`/projects/${projectId}/overview`);
}
