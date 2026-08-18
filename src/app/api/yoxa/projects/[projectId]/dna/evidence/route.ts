import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain, EvidenceType, EvidenceStatus, Confidence, Authority, Severity } from "@/lib/types/domain";

interface EvidenceInput {
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

// POST /api/yoxa/projects/:projectId/dna/evidence
// Backs `update_canonical_renovation_dna`, used by the Evidence Curator to
// apply a provenance-aware patch. Accepts new evidence (each item carrying
// its own status/confidence/authority, exactly the canonical fields the
// Renovation DNA model expects — nothing here is inferred, whatever the
// caller sends is what's stored), optional new questions the patch
// surfaced, and optional conflict records when two evidence items
// contradict each other.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const evidenceInputs: EvidenceInput[] = Array.isArray(body?.evidence) ? body.evidence : [];
  if (evidenceInputs.length === 0) {
    return NextResponse.json({ error: "At least one evidence item is required" }, { status: 400 });
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

  if (evidenceError) return NextResponse.json({ error: evidenceError.message }, { status: 500 });

  const newQuestions: { domain: Domain; questionText: string; whyItMatters?: string; severity?: Severity; blocksReadiness?: boolean }[] =
    Array.isArray(body?.newQuestions) ? body.newQuestions : [];
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

  const conflictInputs: { evidenceAId: string; evidenceBId: string; reason: string; affectedDomains?: Domain[] }[] =
    Array.isArray(body?.conflicts) ? body.conflicts : [];
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

  return NextResponse.json({ evidence: inserted ?? [] }, { status: 201 });
}
