import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";

// POST /api/yoxa/projects/:projectId/handoff-brief
// Backs `generate_role_handoff_brief` from the Collaboration Handoff
// Agent. There's no real DOCX rendering behind this yet — the agent
// composes the role-appropriate brief text itself (the same way a human
// would write it), and this stores it as a handoff_records row exactly
// like the existing in-app "Generate handoff brief" button does
// (src/app/(agency)/projects/[projectId]/handoff/actions.ts), so it shows
// up in the same review/approval screen either way. The "artifact" is a
// link to that screen, not a downloadable file — never claim approval,
// verification, or legal permission on Yoxa's behalf; that stays a human
// action in the existing UI.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json().catch(() => ({}));

  const briefText: string | undefined = body?.briefText;
  if (!briefText) {
    return NextResponse.json({ error: "briefText is required" }, { status: 400 });
  }
  const recipientRole: string = body?.recipientRole ?? "professional";

  const composedBrief = `Recipient: ${recipientRole}\n\n${briefText}`;

  const { data: record, error } = await supabase
    .from("handoff_records")
    .insert({ project_id: projectId, brief: composedBrief, status: "pending_approval" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "handoff_brief_generated",
    payload: { source: "yoxa", recipient_role: recipientRole },
    activity_summary: `Renovagent drafted a handoff brief for ${recipientRole} review.`,
  });

  return NextResponse.json(
    {
      handoffRecord: record,
      artifactReference: `https://renovagent-five.vercel.app/projects/${projectId}/handoff`,
    },
    { status: 201 }
  );
}
