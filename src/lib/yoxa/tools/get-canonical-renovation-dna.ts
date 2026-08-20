import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

// Shared logic behind getCanonicalRenovationDna — used by both the REST
// route (src/app/api/yoxa/projects/[projectId]/dna/route.ts) and the MCP
// server (src/app/api/mcp/route.ts), so there is exactly one place that
// knows what "the full Renovation DNA" actually means.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCanonicalRenovationDna(supabase: SupabaseClient<any>, projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, property_address, scope_summary, budget_comfortable_low, budget_comfortable_high, budget_stretch_low, budget_stretch_high, budget_ceiling, phase, created_at"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw new ToolError(500, projectError.message);
  if (!project) throw new ToolError(404, "Project not found");

  const [
    { data: householdMembers },
    { data: evidence },
    { data: questions },
    { data: assumptions },
    { data: decisions },
    { data: tradeOffs },
    { data: conflicts },
    { data: readiness },
    { data: constraints },
    { data: budgetLines },
    { data: spatialElements },
  ] = await Promise.all([
    supabase
      .from("household_members")
      .select("id, name, role_in_household, is_primary_contact, accessibility_needs")
      .eq("project_id", projectId),
    supabase
      .from("evidence")
      .select(
        "id, domain, evidence_type, statement, status, confidence, authority, source, household_member_id, contradicts_evidence_id, superseded_by_id, related_evidence_ids, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("questions")
      .select("id, domain, question_text, why_it_matters, severity, blocks_readiness, owner_role, status, resolution_evidence_id, created_at, resolved_at")
      .eq("project_id", projectId),
    supabase
      .from("assumptions")
      .select("id, statement, domain, confidence, impact_if_wrong, verification_required, status, created_at")
      .eq("project_id", projectId),
    supabase
      .from("decisions")
      .select("id, decision_text, decision_maker_role, alternatives_considered, rationale, affected_domains, reversibility, status, supersedes_decision_id, created_at")
      .eq("project_id", projectId),
    supabase
      .from("trade_offs")
      .select("id, gained, sacrificed, reason, accepted_by_role, status, created_at")
      .eq("project_id", projectId),
    supabase
      .from("conflicts")
      .select("id, evidence_a_id, evidence_b_id, reason, affected_domains, blocks_decision_id, status, created_at, resolved_at")
      .eq("project_id", projectId),
    supabase.from("readiness").select("domain, state, reason, updated_at").eq("project_id", projectId),
    supabase
      .from("project_constraints")
      .select("id, category, hardness, status, description, evidence_ids, created_at")
      .eq("project_id", projectId),
    supabase
      .from("budget_lines")
      .select("id, category, probable_low, probable_high, estimated, quoted, confirmed, priority_tier, created_at")
      .eq("project_id", projectId),
    supabase
      .from("spatial_elements")
      .select("id, room, element_type, attributes, certainty, requires_verification, evidence_ids, created_at")
      .eq("project_id", projectId),
  ]);

  return {
    project,
    householdMembers: householdMembers ?? [],
    evidence: evidence ?? [],
    questions: questions ?? [],
    assumptions: assumptions ?? [],
    decisions: decisions ?? [],
    tradeOffs: tradeOffs ?? [],
    conflicts: conflicts ?? [],
    readiness: readiness ?? [],
    constraints: constraints ?? [],
    budgetLines: budgetLines ?? [],
    spatialElements: spatialElements ?? [],
  };
}
