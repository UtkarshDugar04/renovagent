import type { SupabaseClient } from "@supabase/supabase-js";
import type { Domain, ReadinessState } from "@/lib/types/domain";
import { ToolError } from "./errors";

export interface ReadinessInput {
  domain: Domain;
  state: ReadinessState;
  reason?: string;
}

export interface RecordReadinessAssessmentInput {
  assessments: ReadinessInput[];
}

// Shared logic behind recordReadinessAssessment — the Validation Agent's
// real, independent gate decision. This is meant to be authoritative for
// whichever domains it assesses, overriding the crude rule-based stub in
// recompute-readiness.ts — see that file's own comment, and the flagged
// risk that nothing currently stops a later evidence write from silently
// re-triggering the stub and clobbering this assessment. See
// get-canonical-renovation-dna.ts for why this lives separately from the
// route handlers that call it.
export async function recordReadinessAssessment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordReadinessAssessmentInput
) {
  const assessments = input.assessments ?? [];
  if (assessments.length === 0) {
    throw new ToolError(400, "At least one readiness assessment is required");
  }

  const { data, error } = await supabase
    .from("readiness")
    .upsert(
      assessments.map((a) => ({
        project_id: projectId,
        domain: a.domain,
        state: a.state,
        reason: a.reason ?? null,
        // Marks this as a real, independent assessment — see
        // recompute-readiness.ts, which backs off once a domain carries
        // this source rather than silently overwriting it.
        source: "validation_agent",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,domain" }
    )
    .select();

  if (error) throw new ToolError(500, error.message);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "readiness_assessed",
    payload: { domains: assessments.map((a) => a.domain), source: "yoxa" },
    activity_summary: `Renovagent assessed readiness for ${assessments.map((a) => a.domain).join(", ")}.`,
  });

  return { readiness: data ?? [] };
}
