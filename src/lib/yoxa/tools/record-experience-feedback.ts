import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDesignOptionFeedback } from "@/lib/dna/design-option-feedback";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain, EvidenceType, EvidenceStatus, Confidence } from "@/lib/types/domain";
import { ToolError } from "./errors";

type DecisionMakerRole = "homeowner" | "agency" | "admin";

export interface ExperienceFeedbackEvidenceInput {
  domain: Domain;
  evidenceType: EvidenceType;
  statement: string;
  status?: EvidenceStatus;
  confidence?: Confidence;
}

export interface ExperienceFeedbackDecisionInput {
  decisionText: string;
  decisionMakerRole?: DecisionMakerRole;
  alternativesConsidered?: string[];
  rationale?: string;
  affectedDomains?: Domain[];
  reversibility?: string;
}

export interface RecordExperienceFeedbackInput {
  designOptionId?: string;
  sentiment?: "like" | "dislike" | "neutral";
  comment?: string;
  subElement?: string;
  evidence?: ExperienceFeedbackEvidenceInput[];
  decision?: ExperienceFeedbackDecisionInput;
}

// Shared logic behind recordExperienceFeedbackV2 — the Experience &
// Decision Facilitator's classified feedback write. Unlike the homeowner-
// facing server action (which takes raw typed text and runs it through our
// own stub), the feedback arriving here has already been classified by
// that agent — evidence and decision fields are written as given, not
// re-derived. See get-canonical-renovation-dna.ts for why this lives
// separately from the route handlers that call it.
export async function recordExperienceFeedback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordExperienceFeedbackInput
) {
  if (input.designOptionId && input.sentiment) {
    await applyDesignOptionFeedback(supabase, {
      designOptionId: input.designOptionId,
      projectId,
      sentiment: input.sentiment,
      comment: input.comment ?? null,
      subElement: input.subElement ?? null,
      createdBy: null,
    });
  }

  const evidenceInputs = input.evidence ?? [];
  let insertedEvidence: unknown[] = [];
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
          confidence: e.confidence ?? "medium",
          authority: "d0_agent",
          source: "yoxa:experience_decision_facilitator",
        }))
      )
      .select();
    if (error) throw new ToolError(500, error.message);
    insertedEvidence = data ?? [];

    const touchedDomains = new Set(evidenceInputs.map((e) => e.domain));
    for (const domain of touchedDomains) {
      await recomputeReadiness(supabase, projectId, domain as Domain);
    }
  }

  let insertedDecision = null;
  if (input.decision) {
    const { data, error } = await supabase
      .from("decisions")
      .insert({
        project_id: projectId,
        decision_text: input.decision.decisionText,
        decision_maker_role: input.decision.decisionMakerRole ?? "homeowner",
        alternatives_considered: input.decision.alternativesConsidered ?? [],
        rationale: input.decision.rationale ?? null,
        affected_domains: input.decision.affectedDomains ?? [],
        reversibility: input.decision.reversibility ?? null,
      })
      .select()
      .single();
    if (error) throw new ToolError(500, error.message);
    insertedDecision = data;
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "experience_feedback_recorded",
    payload: { design_option_id: input.designOptionId ?? null, source: "yoxa" },
    activity_summary: "Renovagent recorded experience feedback and any resulting decision.",
  });

  return { evidence: insertedEvidence, decision: insertedDecision };
}
