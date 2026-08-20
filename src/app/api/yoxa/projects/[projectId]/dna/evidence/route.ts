import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import {
  updateCanonicalRenovationDna,
  type UpdateCanonicalRenovationDnaInput,
} from "@/lib/yoxa/tools/update-canonical-renovation-dna";
import { ToolError } from "@/lib/yoxa/tools/errors";

// POST /api/yoxa/projects/:projectId/dna/evidence
// Backs `update_canonical_renovation_dna`, used by the Evidence Curator to
// apply a provenance-aware patch. Accepts new evidence (each item carrying
// its own status/confidence/authority), optional new questions, optional
// conflict records, and optional structured writes for household members,
// constraints, budget lines, and spatial elements — the tables that used to
// have no write path at all and could only be approximated as generic
// evidence.
//
// The actual logic lives in src/lib/yoxa/tools/update-canonical-renovation-dna.ts,
// shared with the MCP server at /api/mcp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body: UpdateCanonicalRenovationDnaInput = await request.json();

  try {
    const result = await updateCanonicalRenovationDna(supabase, projectId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
