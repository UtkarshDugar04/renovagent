import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  generateRoleHandoffBrief,
  type GenerateRoleHandoffBriefInput,
} from "@/lib/yoxa/tools/generate-role-handoff-brief";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/handoff-brief
// Backs `generate_role_handoff_brief` from the Collaboration Handoff Agent.
//
// The actual logic lives in
// src/lib/yoxa/tools/generate-role-handoff-brief.ts, shared with the MCP
// server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: GenerateRoleHandoffBriefInput = await request.json().catch(() => ({}));

  try {
    const result = await generateRoleHandoffBrief(supabase, projectId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
