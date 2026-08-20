import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

type SourcingStatus = "not_evaluated" | "grounded" | "indicative" | "ungrounded";

export interface DesignOptionInput {
  label: string;
  rationale: string;
  satisfiesEvidenceIds?: string[];
  tradeOffs?: { gained: string; sacrificed: string }[];
  costBand?: { low: number; high: number; confidence: string } | null;
  sourcingStatus?: SourcingStatus;
  whatItWouldFeelLike?: string;
  visibleToHomeowner?: boolean;
}

export interface RecordProposedDesignPackageInput {
  roundNumber?: number;
  options: DesignOptionInput[];
}

// Shared logic behind recordProposedDesignPackage — the Design Agent's
// option registry against a design round. Never marks options approved or
// construction-ready; that's a separate human decision captured through
// experience-feedback. See get-canonical-renovation-dna.ts for why this
// lives separately from the route handlers that call it.
export async function recordProposedDesignPackage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: RecordProposedDesignPackageInput
) {
  const options = input.options ?? [];
  if (options.length === 0) {
    throw new ToolError(400, "At least one design option is required");
  }

  let designRoundId: string;
  const requestedRoundNumber = typeof input.roundNumber === "number" ? input.roundNumber : undefined;

  if (requestedRoundNumber !== undefined) {
    const { data: existingRound } = await supabase
      .from("design_rounds")
      .select("id")
      .eq("project_id", projectId)
      .eq("round_number", requestedRoundNumber)
      .maybeSingle();
    if (existingRound) {
      designRoundId = existingRound.id;
    } else {
      const { data: createdRound, error: roundError } = await supabase
        .from("design_rounds")
        .insert({ project_id: projectId, round_number: requestedRoundNumber })
        .select("id")
        .single();
      if (roundError || !createdRound) {
        throw new ToolError(500, roundError?.message ?? "Failed to create design round");
      }
      designRoundId = createdRound.id;
    }
  } else {
    const { data: latestRound } = await supabase
      .from("design_rounds")
      .select("round_number")
      .eq("project_id", projectId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextRoundNumber = (latestRound?.round_number ?? 0) + 1;
    const { data: createdRound, error: roundError } = await supabase
      .from("design_rounds")
      .insert({ project_id: projectId, round_number: nextRoundNumber })
      .select("id")
      .single();
    if (roundError || !createdRound) {
      throw new ToolError(500, roundError?.message ?? "Failed to create design round");
    }
    designRoundId = createdRound.id;
  }

  const { data: inserted, error: optionsError } = await supabase
    .from("design_options")
    .insert(
      options.map((o) => ({
        project_id: projectId,
        design_round_id: designRoundId,
        label: o.label,
        rationale: o.rationale,
        satisfies_evidence_ids: o.satisfiesEvidenceIds ?? [],
        trade_offs: o.tradeOffs ?? [],
        cost_band: o.costBand ?? null,
        sourcing_status: o.sourcingStatus ?? "not_evaluated",
        what_it_would_feel_like: o.whatItWouldFeelLike ?? null,
        status: "proposed",
        visible_to_homeowner: o.visibleToHomeowner ?? false,
      }))
    )
    .select();

  if (optionsError) throw new ToolError(500, optionsError.message);

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "design_options_proposed",
    payload: { design_round_id: designRoundId, option_count: inserted?.length ?? 0, source: "yoxa" },
    activity_summary: `Renovagent proposed ${inserted?.length ?? 0} design option(s) for review.`,
  });

  return { designRoundId, options: inserted ?? [] };
}
