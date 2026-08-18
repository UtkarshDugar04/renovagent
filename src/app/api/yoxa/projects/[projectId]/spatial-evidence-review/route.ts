import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();

  const [
    { data: spatialElements, error: elementsError },
    { data: spatialEvidence, error: evidenceError },
    { data: openConflicts, error: conflictsError },
  ] = await Promise.all([
    supabase
      .from("spatial_elements")
      .select("id, room, element_type, attributes, certainty, requires_verification, evidence_ids, created_at")
      .eq("project_id", projectId),
    supabase
      .from("evidence")
      .select("id, evidence_type, statement, status, confidence, authority, source, created_at")
      .eq("project_id", projectId)
      .eq("domain", "spatial"),
    supabase
      .from("conflicts")
      .select("id, evidence_a_id, evidence_b_id, reason, affected_domains, status, created_at")
      .eq("project_id", projectId)
      .eq("status", "open")
      .contains("affected_domains", ["spatial"]),
  ]);

  const error = elementsError ?? evidenceError ?? conflictsError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unverifiedElements = (spatialElements ?? []).filter((e) => e.requires_verification);
  const unresolvedEvidence = (spatialEvidence ?? []).filter((e) =>
    ["unresolved", "assumed", "conflicted"].includes(e.status)
  );

  return NextResponse.json({
    spatialElements: spatialElements ?? [],
    spatialEvidence: spatialEvidence ?? [],
    unverifiedElements,
    unresolvedEvidence,
    openConflicts: openConflicts ?? [],
  });
}
