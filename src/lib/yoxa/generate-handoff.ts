// Application ↔ YOXA boundary for the Collaboration Handoff Agent (T9).
// Same pattern as process-turn.ts: a stand-in that assembles a structurally
// correct brief from canonical state, swappable for the real agent call
// later without touching the route or the UI that renders it.

import { createClient } from "@/lib/supabase/server";

export async function generateHandoffBrief(projectId: string) {
  const supabase = await createClient();

  const [{ data: decisions }, { data: escalations }, { data: options }, { data: project }] =
    await Promise.all([
      supabase
        .from("decisions")
        .select("decision_text, rationale")
        .eq("project_id", projectId)
        .eq("status", "active"),
      supabase
        .from("escalations")
        .select("question, trigger, status")
        .eq("project_id", projectId),
      supabase
        .from("design_options")
        .select("label, status")
        .eq("project_id", projectId)
        .eq("visible_to_homeowner", true),
      supabase.from("projects").select("name, scope_summary").eq("id", projectId).single(),
    ]);

  const decisionLines = (decisions ?? [])
    .filter((d) => d.decision_text !== "meaning_verification_confirmed")
    .map((d) => `- ${d.decision_text}${d.rationale ? ` (${d.rationale})` : ""}`)
    .join("\n");

  const unresolvedEscalations = (escalations ?? []).filter((e) => e.status === "open");

  const brief = [
    `Handoff brief — ${project?.name ?? "project"}`,
    "",
    project?.scope_summary ? `Scope: ${project.scope_summary}` : "",
    "",
    "Decisions made:",
    decisionLines || "(none recorded yet)",
    "",
    "Design options presented:",
    (options ?? []).map((o) => `- ${o.label} (${o.status})`).join("\n") || "(none yet)",
    "",
    "Still unresolved:",
    unresolvedEscalations.map((e) => `- ${e.question ?? e.trigger}`).join("\n") ||
      "(nothing outstanding)",
  ]
    .filter(Boolean)
    .join("\n");

  return { brief };
}
