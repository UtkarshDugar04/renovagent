"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recomputeReadiness } from "@/lib/yoxa/recompute-readiness";
import type { Domain } from "@/lib/types/domain";

export async function resolveEscalation(
  escalationId: string,
  projectId: string,
  resolutionText: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: escalation } = await supabase
    .from("escalations")
    .select("domain, question, trigger, required_authority")
    .eq("id", escalationId)
    .single();

  if (!escalation) return { error: "Escalation not found" };

  await supabase
    .from("escalations")
    .update({ status: "resolved", resolution: resolutionText, resolved_at: new Date().toISOString() })
    .eq("id", escalationId);

  // The resolution becomes new, professionally-authoritative evidence —
  // never a silent status flip with no traceable reasoning behind it.
  await supabase.from("evidence").insert({
    project_id: projectId,
    domain: escalation.domain ?? "constraint",
    evidence_type: "verification",
    statement: resolutionText,
    status: "verified",
    confidence: "high",
    authority: escalation.required_authority,
    source: `escalation_resolution:${escalationId}`,
  });

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "verification_completed",
    activity_summary: `Professional verification resolved: ${resolutionText}`,
  });

  await recomputeReadiness(supabase, projectId, (escalation.domain ?? "constraint") as Domain);

  revalidatePath(`/projects/${projectId}/escalations`);
  revalidatePath(`/projects/${projectId}/dna`);
  revalidatePath(`/projects/${projectId}/overview`);
}
