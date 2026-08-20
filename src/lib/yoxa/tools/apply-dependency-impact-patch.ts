import type { SupabaseClient } from "@supabase/supabase-js";
import type { Domain, ReadinessState, Severity } from "@/lib/types/domain";
import { ToolError } from "./errors";

type DecisionMakerRole = "homeowner" | "agency" | "admin";

export interface SupersededDecisionInput {
  oldDecisionId: string;
  newDecisionText: string;
  decisionMakerRole?: DecisionMakerRole;
  rationale?: string;
  affectedDomains?: Domain[];
}

export interface ReadinessUpdateInput {
  domain: Domain;
  state: ReadinessState;
  reason?: string;
}

export interface DependencyImpactQuestionInput {
  domain: Domain;
  questionText: string;
  whyItMatters?: string;
  severity?: Severity;
}

export interface ApplyDependencyImpactPatchInput {
  summary?: string;
  invalidatedDesignOptionIds?: string[];
  supersededDecisions?: SupersededDecisionInput[];
  readinessUpdates?: ReadinessUpdateInput[];
  newQuestions?: DependencyImpactQuestionInput[];
}

// Shared logic behind applyDependencyImpactPatch — the Impact & Change
// Propagation Agent's one adapter for rippling a change through readiness,
// design options, decisions, and open questions at once, without erasing
// history. See get-canonical-renovation-dna.ts for why this lives
// separately from the route handlers that call it.
export async function applyDependencyImpactPatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: ApplyDependencyImpactPatchInput
) {
  const invalidatedDesignOptionIds = input.invalidatedDesignOptionIds ?? [];
  const supersededDecisions = input.supersededDecisions ?? [];
  const readinessUpdates = input.readinessUpdates ?? [];
  const newQuestions = input.newQuestions ?? [];
  const summary = input.summary ?? "Dependency impact applied.";

  if (invalidatedDesignOptionIds.length > 0) {
    const { error } = await supabase
      .from("design_options")
      .update({ status: "rejected" })
      .in("id", invalidatedDesignOptionIds);
    if (error) throw new ToolError(500, error.message);
  }

  const newDecisions = [];
  for (const sd of supersededDecisions) {
    const { data: newDecision, error: insertError } = await supabase
      .from("decisions")
      .insert({
        project_id: projectId,
        decision_text: sd.newDecisionText,
        decision_maker_role: sd.decisionMakerRole ?? null,
        rationale: sd.rationale ?? null,
        affected_domains: sd.affectedDomains ?? [],
        supersedes_decision_id: sd.oldDecisionId,
      })
      .select()
      .single();
    if (insertError) throw new ToolError(500, insertError.message);

    await supabase.from("decisions").update({ status: "superseded" }).eq("id", sd.oldDecisionId);
    newDecisions.push(newDecision);
  }

  if (readinessUpdates.length > 0) {
    const { error } = await supabase.from("readiness").upsert(
      readinessUpdates.map((r) => ({
        project_id: projectId,
        domain: r.domain,
        state: r.state,
        reason: r.reason ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,domain" }
    );
    if (error) throw new ToolError(500, error.message);
  }

  if (newQuestions.length > 0) {
    await supabase.from("questions").insert(
      newQuestions.map((q) => ({
        project_id: projectId,
        domain: q.domain,
        question_text: q.questionText,
        why_it_matters: q.whyItMatters ?? null,
        severity: q.severity ?? "e1",
      }))
    );
  }

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "dependency_impact_applied",
    payload: {
      invalidated_design_option_count: invalidatedDesignOptionIds.length,
      superseded_decision_count: supersededDecisions.length,
      source: "yoxa",
    },
    activity_summary: summary,
  });

  return { invalidatedDesignOptionIds, newDecisions };
}
