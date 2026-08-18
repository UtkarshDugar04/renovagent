import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";
import type { Domain, ReadinessState, Severity } from "@/lib/types/domain";

type DecisionMakerRole = "homeowner" | "agency" | "admin";

interface SupersededDecisionInput {
  oldDecisionId: string;
  newDecisionText: string;
  decisionMakerRole?: DecisionMakerRole;
  rationale?: string;
  affectedDomains?: Domain[];
}

interface ReadinessUpdateInput {
  domain: Domain;
  state: ReadinessState;
  reason?: string;
}

interface NewQuestionInput {
  domain: Domain;
  questionText: string;
  whyItMatters?: string;
  severity?: Severity;
}

// POST /api/yoxa/projects/:projectId/dependency-impact
// Backs `apply_dependency_impact_patch` from the Impact and Change
// Propagation Agent. This is the one tool that touches several tables at
// once by design — a single change (a rejected option, a superseded
// decision) has to ripple through readiness and open new questions
// without erasing history, so it's one adapter endpoint rather than
// several simulated tools each doing part of the propagation.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const invalidatedDesignOptionIds: string[] = Array.isArray(body?.invalidatedDesignOptionIds)
    ? body.invalidatedDesignOptionIds
    : [];
  const supersededDecisions: SupersededDecisionInput[] = Array.isArray(body?.supersededDecisions)
    ? body.supersededDecisions
    : [];
  const readinessUpdates: ReadinessUpdateInput[] = Array.isArray(body?.readinessUpdates) ? body.readinessUpdates : [];
  const newQuestions: NewQuestionInput[] = Array.isArray(body?.newQuestions) ? body.newQuestions : [];
  const summary: string = typeof body?.summary === "string" ? body.summary : "Dependency impact applied.";

  if (invalidatedDesignOptionIds.length > 0) {
    const { error } = await supabase
      .from("design_options")
      .update({ status: "rejected" })
      .in("id", invalidatedDesignOptionIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  return NextResponse.json({
    invalidatedDesignOptionIds,
    newDecisions,
  });
}
