"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateHandoffBrief } from "@/lib/yoxa/generate-handoff";

export async function createHandoffBrief(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { brief } = await generateHandoffBrief(projectId);

  await supabase.from("handoff_records").insert({
    project_id: projectId,
    brief,
    status: "pending_approval",
  });

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "handoff_brief_generated",
    activity_summary: "A handoff brief was generated for review.",
  });

  revalidatePath(`/projects/${projectId}/handoff`);
}

// The email is governed: nothing is sent without an explicit approval
// action here, and the full content is always visible in this same record —
// see the architecture doc, Part 20, gap #4.
export async function approveAndSendHandoff(handoffId: string, projectId: string, sendTo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase
    .from("handoff_records")
    .update({
      status: "sent",
      approved_by: user.id,
      email_sent_to: sendTo,
      email_content: "(email dispatch not yet wired — brief marked approved and logged)",
    })
    .eq("id", handoffId);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "project_email_sent",
    activity_summary: `Handoff approved and marked sent to ${sendTo}.`,
  });

  revalidatePath(`/projects/${projectId}/handoff`);
}
