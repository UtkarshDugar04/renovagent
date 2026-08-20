import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import { getCanonicalRenovationDna } from "@/lib/yoxa/tools/get-canonical-renovation-dna";
import { ToolError } from "@/lib/yoxa/tools/errors";

// GET /api/yoxa/projects/:projectId/dna
// Backs the `retrieve_canonical_renovation_dna` tool used by every agent in
// the Yoxa workflow. Returns the full project-scoped subset — household,
// evidence, questions, assumptions, decisions, conflicts, readiness,
// constraints, budget lines, spatial elements — as one JSON envelope. Yoxa
// agents filter to what's relevant to their own step; this route doesn't
// do per-agent scoping, since RLS-style row filtering by agent role isn't
// meaningful for a single trusted service caller.
//
// The actual logic lives in src/lib/yoxa/tools/get-canonical-renovation-dna.ts,
// shared with the MCP server at /api/mcp so there's exactly one
// implementation of "what Renovation DNA means" for both transports.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();

  try {
    const dna = await getCanonicalRenovationDna(supabase, projectId);
    return NextResponse.json(dna);
  } catch (err) {
    if (err instanceof ToolError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
