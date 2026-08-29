// Stand-in for Planning's readiness proposal + Validation's independent
// confirmation (the two-step distinction from the architecture doc — a
// proposal alone must never flip what the UI shows as "validated"). This
// is a rule-based approximation so the rest of the product loop (Meaning
// Verification gate, Design unlocking) is actually testable before the
// real Planning/Validation agents exist; swap the two functions below,
// not their callers, once they do.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Domain } from "@/lib/types/domain";

function proposeReadiness(evidenceCount: number, openBlockingQuestions: number): string {
  if (openBlockingQuestions > 0) return "partially_understood";
  if (evidenceCount === 0) return "not_started";
  if (evidenceCount < 2) return "discovery_in_progress";
  if (evidenceCount < 4) return "partially_understood";
  return "sufficient_for_validation";
}

// Validation independently re-checks rather than trusting the proposal —
// here, that means no unresolved conflict may touch the domain.
function validateReadiness(proposed: string, openConflicts: number): string {
  if (proposed === "sufficient_for_validation" && openConflicts === 0) {
    return "validated";
  }
  return proposed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recomputeReadiness(supabase: SupabaseClient<any>, projectId: string, domain: Domain) {
  // Back off entirely once this domain carries a real, independent
  // assessment — recordReadinessAssessment (Validation Agent) and
  // applyDependencyImpactPatch (Impact & Change Propagation Agent) both
  // mark their writes source="validation_agent". Without this check, the
  // very next unrelated evidence write on this domain — including from the
  // live-call path — would silently overwrite that real assessment with
  // this heuristic's own count-based guess, with no trace of what happened.
  const { data: existing } = await supabase
    .from("readiness")
    .select("state, source")
    .eq("project_id", projectId)
    .eq("domain", domain)
    .maybeSingle();
  if (existing?.source === "validation_agent") {
    return existing.state;
  }

  const [{ count: evidenceCount }, { count: blockingQuestions }, { count: openConflicts }] =
    await Promise.all([
      supabase
        .from("evidence")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("domain", domain)
        .in("status", ["explicit", "verified", "inferred"]),
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("domain", domain)
        .eq("status", "open")
        .eq("blocks_readiness", true),
      supabase
        .from("conflicts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "open")
        .contains("affected_domains", [domain]),
    ]);

  const proposed = proposeReadiness(evidenceCount ?? 0, blockingQuestions ?? 0);
  const state = validateReadiness(proposed, openConflicts ?? 0);

  const reason =
    state === "validated"
      ? `${evidenceCount} pieces of evidence, no open conflicts or blocking questions.`
      : (openConflicts ?? 0) > 0
      ? "An unresolved conflict is affecting this domain."
      : (blockingQuestions ?? 0) > 0
      ? "A blocking question is still open."
      : `${evidenceCount ?? 0} pieces of evidence so far.`;

  await supabase
    .from("readiness")
    .upsert({ project_id: projectId, domain, state, reason, source: "heuristic", updated_at: new Date().toISOString() });

  return state;
}
