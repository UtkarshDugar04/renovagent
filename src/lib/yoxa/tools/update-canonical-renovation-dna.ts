import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain, EvidenceType, EvidenceStatus, Confidence, Authority, Severity } from "@/lib/types/domain";
import type { Json } from "@/lib/types/database";
import { ToolError } from "./errors";

export interface EvidenceInput {
  domain: Domain;
  evidenceType: EvidenceType;
  statement: string;
  status?: EvidenceStatus;
  confidence?: Confidence;
  authority?: Authority;
  source?: string;
  contradictsEvidenceId?: string;
  supersededById?: string;
}

export interface HouseholdMemberInput {
  name: string;
  roleInHousehold?: string;
  isPrimaryContact?: boolean;
  accessibilityNeeds?: string;
}

export interface ConstraintInput {
  category: string;
  hardness: "hard" | "soft" | "negotiable";
  status?: "confirmed" | "provisional" | "unresolved" | "requires_verification" | "cleared";
  description: string;
  evidenceIds?: string[];
}

export interface BudgetLineInput {
  category: string;
  probableLow?: number;
  probableHigh?: number;
  estimated?: number;
  quoted?: number;
  confirmed?: number;
  priorityTier?: string;
}

export interface SpatialElementInput {
  room?: string;
  elementType: string;
  attributes?: Json;
  certainty: Confidence;
  requiresVerification?: boolean;
  evidenceIds?: string[];
}

export interface QuestionInput {
  domain: Domain;
  questionText: string;
  whyItMatters?: string;
  severity?: Severity;
  blocksReadiness?: boolean;
}

export interface ConflictInput {
  evidenceAId: string;
  evidenceBId: string;
  reason: string;
  affectedDomains?: Domain[];
}

export interface UpdateCanonicalRenovationDnaInput {
  evidence: EvidenceInput[];
  newQuestions?: QuestionInput[];
  conflicts?: ConflictInput[];
  householdMembers?: HouseholdMemberInput[];
  constraints?: ConstraintInput[];
  budgetLines?: BudgetLineInput[];
  spatialElements?: SpatialElementInput[];
}

// Shared logic behind updateCanonicalRenovationDna — see
// get-canonical-renovation-dna.ts for why this lives separately from the
// route handlers that call it.
export async function updateCanonicalRenovationDna(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: UpdateCanonicalRenovationDnaInput
) {
  const evidenceInputs = input.evidence ?? [];
  if (evidenceInputs.length === 0) {
    throw new ToolError(400, "At least one evidence item is required");
  }

  const { data: inserted, error: evidenceError } = await supabase
    .from("evidence")
    .insert(
      evidenceInputs.map((e) => ({
        project_id: projectId,
        domain: e.domain,
        evidence_type: e.evidenceType,
        statement: e.statement,
        status: e.status ?? "explicit",
        confidence: e.confidence ?? "unknown",
        authority: e.authority ?? "d0_agent",
        source: e.source ?? "yoxa:evidence_curator",
        contradicts_evidence_id: e.contradictsEvidenceId ?? null,
        superseded_by_id: e.supersededById ?? null,
      }))
    )
    .select();

  if (evidenceError) throw new ToolError(500, evidenceError.message);

  const newQuestions = input.newQuestions ?? [];
  if (newQuestions.length > 0) {
    await supabase.from("questions").insert(
      newQuestions.map((q) => ({
        project_id: projectId,
        domain: q.domain,
        question_text: q.questionText,
        why_it_matters: q.whyItMatters ?? null,
        severity: q.severity ?? "e1",
        blocks_readiness: q.blocksReadiness ?? false,
      }))
    );
  }

  const conflictInputs = input.conflicts ?? [];
  if (conflictInputs.length > 0) {
    await supabase.from("conflicts").insert(
      conflictInputs.map((c) => ({
        project_id: projectId,
        evidence_a_id: c.evidenceAId,
        evidence_b_id: c.evidenceBId,
        reason: c.reason,
        affected_domains: c.affectedDomains ?? [],
      }))
    );
  }

  const householdMemberInputs = input.householdMembers ?? [];
  let insertedHouseholdMembers: unknown[] = [];
  if (householdMemberInputs.length > 0) {
    const { data, error } = await supabase
      .from("household_members")
      .insert(
        householdMemberInputs.map((m) => ({
          project_id: projectId,
          name: m.name,
          role_in_household: m.roleInHousehold ?? null,
          is_primary_contact: m.isPrimaryContact ?? false,
          accessibility_needs: m.accessibilityNeeds ?? null,
        }))
      )
      .select();
    if (error) throw new ToolError(500, error.message);
    insertedHouseholdMembers = data ?? [];
  }

  const constraintInputs = input.constraints ?? [];
  let insertedConstraints: unknown[] = [];
  if (constraintInputs.length > 0) {
    const { data, error } = await supabase
      .from("project_constraints")
      .insert(
        constraintInputs.map((c) => ({
          project_id: projectId,
          category: c.category,
          hardness: c.hardness,
          status: c.status ?? "unresolved",
          description: c.description,
          evidence_ids: c.evidenceIds ?? [],
        }))
      )
      .select();
    if (error) throw new ToolError(500, error.message);
    insertedConstraints = data ?? [];
  }

  const budgetLineInputs = input.budgetLines ?? [];
  let insertedBudgetLines: unknown[] = [];
  if (budgetLineInputs.length > 0) {
    const { data, error } = await supabase
      .from("budget_lines")
      .insert(
        budgetLineInputs.map((b) => ({
          project_id: projectId,
          category: b.category,
          probable_low: b.probableLow ?? null,
          probable_high: b.probableHigh ?? null,
          estimated: b.estimated ?? null,
          quoted: b.quoted ?? null,
          confirmed: b.confirmed ?? null,
          priority_tier: b.priorityTier ?? "unspecified",
        }))
      )
      .select();
    if (error) throw new ToolError(500, error.message);
    insertedBudgetLines = data ?? [];
  }

  const spatialElementInputs = input.spatialElements ?? [];
  let insertedSpatialElements: unknown[] = [];
  if (spatialElementInputs.length > 0) {
    const { data, error } = await supabase
      .from("spatial_elements")
      .insert(
        spatialElementInputs.map((s) => ({
          project_id: projectId,
          room: s.room ?? null,
          element_type: s.elementType,
          attributes: s.attributes ?? {},
          certainty: s.certainty,
          requires_verification: s.requiresVerification ?? false,
          evidence_ids: s.evidenceIds ?? [],
        }))
      )
      .select();
    if (error) throw new ToolError(500, error.message);
    insertedSpatialElements = data ?? [];
  }

  const touchedDomains = new Set(evidenceInputs.map((e) => e.domain));
  for (const domain of touchedDomains) {
    await recomputeReadiness(supabase, projectId, domain as Domain);
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "evidence_extracted",
    payload: { evidence_count: inserted?.length ?? 0, source: "yoxa" },
    activity_summary: `Renovagent's intelligence captured ${inserted?.length ?? 0} new piece(s) of information.`,
  });

  return {
    evidence: inserted ?? [],
    householdMembers: insertedHouseholdMembers,
    constraints: insertedConstraints,
    budgetLines: insertedBudgetLines,
    spatialElements: insertedSpatialElements,
  };
}
