import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

export interface GenerateRoleHandoffBriefInput {
  recipientRole?: string;
  briefText: string;
}

// Shared logic behind generateRoleHandoffBrief — the Collaboration Handoff
// Agent's final act. There's no real DOCX rendering behind this — the
// agent composes the role-appropriate brief text itself, and this stores
// it as a handoff_records row exactly like the existing in-app "Generate
// handoff brief" button does, so it shows up in the same review/approval
// screen either way. The "artifact" is a link to that screen, not a
// downloadable file — approval and delivery stay a human action in the
// existing UI, never something this call triggers itself. See
// get-canonical-renovation-dna.ts for why this lives separately from the
// route handlers that call it.
export async function generateRoleHandoffBrief(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: GenerateRoleHandoffBriefInput
) {
  if (!input.briefText) {
    throw new ToolError(400, "briefText is required");
  }
  const recipientRole = input.recipientRole ?? "professional";

  const composedBrief = `Recipient: ${recipientRole}\n\n${input.briefText}`;

  const { data: record, error } = await supabase
    .from("handoff_records")
    .insert({ project_id: projectId, brief: composedBrief, status: "pending_approval" })
    .select()
    .single();

  if (error) throw new ToolError(500, error.message);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "handoff_brief_generated",
    payload: { source: "yoxa", recipient_role: recipientRole },
    activity_summary: `Renovagent drafted a handoff brief for ${recipientRole} review.`,
  });

  return {
    handoffRecord: record,
    artifactReference: `https://renovagent-five.vercel.app/projects/${projectId}/handoff`,
  };
}
