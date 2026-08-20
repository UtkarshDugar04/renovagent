import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

// Shared logic behind reviewSpatialEvidence — see get-canonical-renovation-dna.ts
// for why this lives separately from the route handlers that call it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reviewSpatialEvidence(supabase: SupabaseClient<any>, projectId: string) {
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
  if (error) throw new ToolError(500, error.message);

  const unverifiedElements = (spatialElements ?? []).filter((e) => e.requires_verification);
  const unresolvedEvidence = (spatialEvidence ?? []).filter((e) =>
    ["unresolved", "assumed", "conflicted"].includes(e.status)
  );

  return {
    spatialElements: spatialElements ?? [],
    spatialEvidence: spatialEvidence ?? [],
    unverifiedElements,
    unresolvedEvidence,
    openConflicts: openConflicts ?? [],
  };
}
