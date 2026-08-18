import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";

type SourcingStatus = "not_evaluated" | "grounded" | "indicative" | "ungrounded";

interface DesignOptionInput {
  label: string;
  rationale: string;
  satisfiesEvidenceIds?: string[];
  tradeOffs?: { gained: string; sacrificed: string }[];
  costBand?: { low: number; high: number; confidence: string } | null;
  sourcingStatus?: SourcingStatus;
  whatItWouldFeelLike?: string;
  visibleToHomeowner?: boolean;
}

// POST /api/yoxa/projects/:projectId/design-options
// Backs `record_proposed_design_package` from the Design Exploration
// Agent. Registers proposed options against a design round — never marks
// them approved or construction-ready, that's a separate human decision
// captured through experience-feedback. Creates a new design_round when
// roundNumber isn't supplied or doesn't exist yet for this project.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  const body = await request.json();

  const options: DesignOptionInput[] = Array.isArray(body?.options) ? body.options : [];
  if (options.length === 0) {
    return NextResponse.json({ error: "At least one design option is required" }, { status: 400 });
  }

  let designRoundId: string;
  const requestedRoundNumber: number | undefined = typeof body?.roundNumber === "number" ? body.roundNumber : undefined;

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
        return NextResponse.json({ error: roundError?.message ?? "Failed to create design round" }, { status: 500 });
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
      return NextResponse.json({ error: roundError?.message ?? "Failed to create design round" }, { status: 500 });
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

  if (optionsError) return NextResponse.json({ error: optionsError.message }, { status: 500 });

  await supabase.from("events").insert({
    project_id: projectId,
    event_type: "design_options_proposed",
    payload: { design_round_id: designRoundId, option_count: inserted?.length ?? 0, source: "yoxa" },
    activity_summary: `Renovagent proposed ${inserted?.length ?? 0} design option(s) for review.`,
  });

  return NextResponse.json({ designRoundId, options: inserted ?? [] }, { status: 201 });
}
