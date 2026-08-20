import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  recordPendingOrchestrationState,
  type RecordPendingOrchestrationStateInput,
} from "@/lib/yoxa/tools/record-pending-orchestration-state";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/orchestration-state
// Backs `record_pending_orchestration_state` from the Planning and
// Orchestration Agent.
//
// The actual logic lives in
// src/lib/yoxa/tools/record-pending-orchestration-state.ts, shared with the
// MCP server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: RecordPendingOrchestrationStateInput = await request.json();

  try {
    const result = await recordPendingOrchestrationState(supabase, projectId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
