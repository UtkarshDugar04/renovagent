import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import type { Json } from "@/lib/types/database";

interface PendingActionInput {
  description: string;
  owner?: string;
  dueContext?: string;
}

// POST /api/yoxa/projects/:projectId/orchestration-state
// Backs `record_pending_orchestration_state` from the Planning and
// Orchestration Agent. There's no dedicated table for "pending next
// actions" — it's stored as a structured events row rather than a new
// table, since it's append-only status the agency/homeowner read, not
// something either of them edits directly. Revisit as a real table if it
// ever needs to be queried or updated in place.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const summary: string | undefined = body?.summary;
  if (!summary) {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }

  const pendingActions: PendingActionInput[] = Array.isArray(body?.pendingActions) ? body.pendingActions : [];
  const escalationLevel: string | undefined = body?.escalationLevel;

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      project_id: projectId,
      event_type: "orchestration_state",
      payload: { pendingActions, escalationLevel: escalationLevel ?? null, source: "yoxa" } as unknown as Json,
      activity_summary: summary,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event }, { status: 201 });
}
