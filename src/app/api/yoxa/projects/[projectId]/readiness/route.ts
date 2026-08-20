import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  recordReadinessAssessment,
  type RecordReadinessAssessmentInput,
} from "@/lib/yoxa/tools/record-readiness-assessment";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/readiness
// Backs `record_readiness_assessment`. This is the real Validation Agent's
// gate decision, meant to override the internal rule-based stub
// (src/lib/yoxa/recompute-readiness.ts) for whichever domains it assesses —
// see that file's own comment. Nothing currently stops a later evidence
// write from re-triggering the stub and silently overwriting this
// assessment; flagged, not fixed here.
//
// The actual logic lives in
// src/lib/yoxa/tools/record-readiness-assessment.ts, shared with the MCP
// server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: RecordReadinessAssessmentInput = await request.json();

  try {
    const result = await recordReadinessAssessment(supabase, projectId, body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
