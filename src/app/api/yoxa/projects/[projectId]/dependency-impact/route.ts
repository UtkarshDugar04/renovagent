import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  applyDependencyImpactPatch,
  type ApplyDependencyImpactPatchInput,
} from "@/lib/yoxa/tools/apply-dependency-impact-patch";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/dependency-impact
// Backs `apply_dependency_impact_patch` from the Impact and Change
// Propagation Agent.
//
// The actual logic lives in
// src/lib/yoxa/tools/apply-dependency-impact-patch.ts, shared with the MCP
// server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: ApplyDependencyImpactPatchInput = await request.json();

  try {
    const result = await applyDependencyImpactPatch(supabase, projectId, body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
