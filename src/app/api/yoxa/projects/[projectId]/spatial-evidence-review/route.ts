import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import { reviewSpatialEvidence } from "@/lib/yoxa/tools/review-spatial-evidence";
import { ToolError } from "@/lib/yoxa/tools/errors";

// GET /api/yoxa/projects/:projectId/spatial-evidence-review
// Backs `review_spatial_evidence` from the Spatial Intelligence Agent.
// There's no image/document understanding behind this — it can't actually
// compare a photo to a measurement. What it can honestly do is gather
// exactly the spatial-domain evidence and elements the agent needs for
// that comparison, and deterministically flag what's already known to be
// unresolved (requires_verification elements, unresolved/assumed/
// conflicted evidence, open conflicts touching the spatial domain) so the
// agent doesn't have to re-derive that from the full DNA retrieval. The
// actual comparison and judgement stays with the agent.
//
// The actual logic lives in src/lib/yoxa/tools/review-spatial-evidence.ts,
// shared with the MCP server at /api/mcp.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();

  try {
    const result = await reviewSpatialEvidence(supabase, projectId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
