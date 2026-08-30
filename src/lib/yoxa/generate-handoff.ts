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
        .select("id, label, status")
        .eq("project_id", projectId)
        .eq("visible_to_homeowner", true),
      supabase.from("projects").select("name, scope_summary").eq("id", projectId).single(),
    ]);

  // Real vendor/product/price for whichever options actually have any —
  // the whole point of a handoff document is giving whoever executes this
  // something concrete to act on, not just a description of intent.
  const { data: sourcedProducts } = options && options.length > 0
    ? await supabase
        .from("sourced_products")
        .select("design_option_id, vendor_name, product_name, product_url, price, currency")
        .in("design_option_id", options.map((o) => o.id))
    : { data: [] as { design_option_id: string; vendor_name: string; product_name: string; product_url: string | null; price: number | null; currency: string }[] };

  const productsByOption = new Map<string, typeof sourcedProducts>();
  for (const p of sourcedProducts ?? []) {
    const existing = productsByOption.get(p.design_option_id) ?? [];
    existing.push(p);
    productsByOption.set(p.design_option_id, existing);
  }

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
    (options ?? [])
      .map((o) => {
        const products = productsByOption.get(o.id) ?? [];
        const productLines = products
          .map((p) => `  · ${p!.vendor_name} — ${p!.product_name}${p!.price != null ? ` (${p!.currency} ${p!.price.toLocaleString("en-IN")})` : ""}${p!.product_url ? ` — ${p!.product_url}` : ""}`)
          .join("\n");
        return `- ${o.label} (${o.status})${productLines ? `\n${productLines}` : ""}`;
      })
      .join("\n") || "(none yet)",
    "",
    "Still unresolved:",
    unresolvedEscalations.map((e) => `- ${e.question ?? e.trigger}`).join("\n") ||
      "(nothing outstanding)",
  ]
    .filter(Boolean)
    .join("\n");

  return { brief };
}
