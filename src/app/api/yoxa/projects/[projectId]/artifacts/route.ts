import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  recordEngineArtifact,
  type RecordEngineArtifactInput,
} from "@/lib/yoxa/tools/record-engine-artifact";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/artifacts
// Backs `record_engine_artifact` — a Step 2 domain agent's composed output
// (Preference Intelligence's moodboard, Family Intelligence's persona,
// Spatial Intelligence's rough schematic, Constraint Intelligence's
// summary), rendered on Renovagent's own dashboard. Not routed through
// Yoxa's own Output Tool, which has no confirmed path back into this
// product.
//
// The actual logic lives in src/lib/yoxa/tools/record-engine-artifact.ts,
// shared with the MCP server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: RecordEngineArtifactInput = await request.json();

  try {
    const result = await recordEngineArtifact(supabase, projectId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
