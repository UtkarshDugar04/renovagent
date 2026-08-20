import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  recordExperienceFeedback,
  type RecordExperienceFeedbackInput,
} from "@/lib/yoxa/tools/record-experience-feedback";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/experience-feedback
// Backs `record_experience_feedback` from the Experience and Decision
// Facilitator.
//
// The actual logic lives in
// src/lib/yoxa/tools/record-experience-feedback.ts, shared with the MCP
// server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: RecordExperienceFeedbackInput = await request.json();

  try {
    const result = await recordExperienceFeedback(supabase, projectId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
