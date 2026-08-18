import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import { applyDesignOptionFeedback } from "@/lib/dna/design-option-feedback";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain, EvidenceType, EvidenceStatus, Confidence } from "@/lib/types/domain";

type DecisionMakerRole = "homeowner" | "agency" | "admin";

interface DecisionInput {
  decisionText: string;
  decisionMakerRole?: DecisionMakerRole;
  alternativesConsidered?: string[];
  rationale?: string;
  affectedDomains?: Domain[];
  reversibility?: string;
}

// POST /api/yoxa/projects/:projectId/experience-feedback
// Backs `record_experience_feedback` from the Experience and Decision
// Facilitator. Unlike the homeowner-facing server action (which takes raw
// typed text and runs it through our own stub to interpret it), the
// feedback arriving here has already been classified by that agent — the
// evidence and decision fields are written as given, not re-derived.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const designOptionId: string | undefined = body?.designOptionId;
  const sentiment: "like" | "dislike" | "neutral" | undefined = body?.sentiment;

  if (designOptionId && sentiment) {
    await applyDesignOptionFeedback(supabase, {
      designOptionId,
      projectId,
      sentiment,
      comment: body?.comment ?? null,
      subElement: body?.subElement ?? null,
      createdBy: null,
    });
  }

  const evidenceInputs: { domain: Domain; evidenceType: EvidenceType; statement: string; status?: EvidenceStatus; confidence?: Confidence }[] =
    Array.isArray(body?.evidence) ? body.evidence : [];

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    insertedEvidence = data ?? [];

    const touchedDomains = new Set(evidenceInputs.map((e) => e.domain));
    for (const domain of touchedDomains) {
      await recomputeReadiness(supabase, projectId, domain as Domain);
    }
  }

  const decisionInput: DecisionInput | undefined = body?.decision;
  let insertedDecision = null;
  if (decisionInput) {
    const { data, error } = await supabase
      .from("decisions")
      .insert({
        project_id: projectId,
        decision_text: decisionInput.decisionText,
        decision_maker_role: decisionInput.decisionMakerRole ?? "homeowner",
        alternatives_considered: decisionInput.alternativesConsidered ?? [],
        rationale: decisionInput.rationale ?? null,
        affected_domains: decisionInput.affectedDomains ?? [],
        reversibility: decisionInput.reversibility ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    insertedDecision = data;
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "experience_feedback_recorded",
    payload: { design_option_id: designOptionId ?? null, source: "yoxa" },
    activity_summary: "Renovagent recorded experience feedback and any resulting decision.",
  });

  return NextResponse.json({ evidence: insertedEvidence, decision: insertedDecision }, { status: 201 });
}
