import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain, EvidenceType, EvidenceStatus, Confidence, Authority, Severity } from "@/lib/types/domain";
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

// Fixed, named fields rather than an arbitrary key-value object — a
// free-form record renders in JSON Schema as an open-ended object
// (additionalProperties), which a number of function-calling providers
// reject outright. These four cover every real use seen so far (room
// dimensions, layout style, what an element sits between, free-text notes);
// extend this list rather than reintroducing a free-form field if a new
// need shows up.
export interface SpatialElementAttributes {
  approxSqm?: number;
  layout?: string;
  adjacentRooms?: string[];
  notes?: string;
}

export interface SpatialElementInput {
  room?: string;
  elementType: string;
  attributes?: SpatialElementAttributes;
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
  evidence?: EvidenceInput[];
  newQuestions?: QuestionInput[];
  conflicts?: ConflictInput[];
  householdMembers?: HouseholdMemberInput[];
  constraints?: ConstraintInput[];
  budgetLines?: BudgetLineInput[];
  spatialElements?: SpatialElementInput[];
}

// Shared logic behind every DNA-writing MCP tool. Originally exposed as one
// combined tool (updateCanonicalRenovationDna) with all seven arrays as
// parameters — that tool's schema turned out to be too large/complex for
// Yoxa's configured model provider to bind at all (every agent using it
// failed instantly with model.schema_incompatible, before any real
// execution). Now exposed as seven focused MCP tools (recordEvidence,
// recordQuestions, recordConflicts, recordHouseholdMembers,
// recordConstraints, recordBudgetLines, recordSpatialElements — see
// src/app/api/mcp/route.ts), each calling this same function with only its
// one field populated. The REST route still accepts the full combined
// shape in one call, since PostgREST callers aren't subject to LLM
// function-calling schema limits.
export async function updateCanonicalRenovationDna(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: UpdateCanonicalRenovationDnaInput
) {
  const evidenceInputs = input.evidence ?? [];
  const newQuestions = input.newQuestions ?? [];
  const conflictInputs = input.conflicts ?? [];
  const householdMemberInputs = input.householdMembers ?? [];
  const constraintInputs = input.constraints ?? [];
  const budgetLineInputs = input.budgetLines ?? [];
  const spatialElementInputs = input.spatialElements ?? [];

  const totalItems =
    evidenceInputs.length +
    newQuestions.length +
    conflictInputs.length +
    householdMemberInputs.length +
    constraintInputs.length +
    budgetLineInputs.length +
    spatialElementInputs.length;
  if (totalItems === 0) {
    throw new ToolError(400, "At least one item is required across evidence, newQuestions, conflicts, householdMembers, constraints, budgetLines, or spatialElements");
  }

  let inserted: unknown[] = [];
  if (evidenceInputs.length > 0) {
    const { data, error } = await supabase
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
    if (error) throw new ToolError(500, error.message);
    inserted = data ?? [];
  }

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

  const touchedDomains = new Set<Domain>(evidenceInputs.map((e) => e.domain));
  if (constraintInputs.length > 0) touchedDomains.add("constraint");
  if (budgetLineInputs.length > 0) touchedDomains.add("budget");
  if (spatialElementInputs.length > 0) touchedDomains.add("spatial");
  for (const domain of touchedDomains) {
    await recomputeReadiness(supabase, projectId, domain);
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "evidence_extracted",
    payload: { total_item_count: totalItems, source: "yoxa" },
    activity_summary: `Renovagent's intelligence captured ${totalItems} new piece(s) of information.`,
  });

  return {
    evidence: inserted,
    householdMembers: insertedHouseholdMembers,
    constraints: insertedConstraints,
    budgetLines: insertedBudgetLines,
    spatialElements: insertedSpatialElements,
  };
}
