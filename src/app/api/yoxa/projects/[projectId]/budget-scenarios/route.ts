import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireYoxaAuth } from "@/lib/yoxa/inbound-auth";

interface CategoryEstimateInput {
  category: string;
  estimated: number;
}

// POST /api/yoxa/projects/:projectId/budget-scenarios
// Backs `calculate_budget_scenarios` from the Budget Intelligence Agent.
// Deliberately a pure, deterministic calculation over real budget_lines
// rows and the project's own ceiling — never an LLM guess at a price. It
// does not write anything; scenario category estimates the agent supplies
// are used only for this one calculation, not persisted, since there's no
// tool in this workflow for writing real budget lines yet.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const authError = requireYoxaAuth(request);
  if (authError) return authError;

  const { projectId } = await params;
  const supabase = createServiceClient();
  // Body is optional on this endpoint (every field defaults) — a caller
  // that sends no body at all, or an empty one, must not 500.
  const body = await request.json().catch(() => ({}));

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("budget_ceiling, budget_comfortable_low, budget_comfortable_high, budget_stretch_high")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: budgetLines, error: linesError } = await supabase
    .from("budget_lines")
    .select("category, probable_low, probable_high, estimated, quoted, confirmed")
    .eq("project_id", projectId);
  if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 });

  const contingencyPercent: number = typeof body?.contingencyPercent === "number" ? body.contingencyPercent : 10;
  const hypotheticalEstimates: CategoryEstimateInput[] = Array.isArray(body?.categoryEstimates)
    ? body.categoryEstimates
    : [];

  const categories = (budgetLines ?? []).map((line) => {
    let amount: number | null = null;
    let basis: "confirmed" | "quoted" | "estimated" | "assumption" | "unknown" = "unknown";

    if (line.confirmed != null) {
      amount = line.confirmed;
      basis = "confirmed";
    } else if (line.quoted != null) {
      amount = line.quoted;
      basis = "quoted";
    } else if (line.estimated != null) {
      amount = line.estimated;
      basis = "estimated";
    } else if (line.probable_low != null && line.probable_high != null) {
      amount = (line.probable_low + line.probable_high) / 2;
      basis = "assumption";
    }

    return { category: line.category, amount, basis };
  });

  for (const h of hypotheticalEstimates) {
    if (!categories.some((c) => c.category === h.category)) {
      categories.push({ category: h.category, amount: h.estimated, basis: "assumption" });
    }
  }

  const totalPlanned = categories.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const ceiling: number | null = project.budget_ceiling ?? project.budget_comfortable_high ?? null;
  const contingencyReserve = ceiling != null ? Math.round(ceiling * (contingencyPercent / 100)) : null;
  const preContingencyEnvelope = ceiling != null && contingencyReserve != null ? ceiling - contingencyReserve : null;
  const remainingMargin = preContingencyEnvelope != null ? preContingencyEnvelope - totalPlanned : null;

  return NextResponse.json({
    ceiling,
    comfortableLow: project.budget_comfortable_low,
    comfortableHigh: project.budget_comfortable_high,
    stretchHigh: project.budget_stretch_high,
    contingencyPercent,
    contingencyReserve,
    preContingencyEnvelope,
    categories,
    totalPlanned,
    remainingMargin,
    remainingMarginBasis: categories.some((c) => c.basis === "unknown" || c.basis === "assumption")
      ? "Some category amounts are assumptions or unresolved — this margin is illustrative, not a quoted total."
      : "All category amounts are quoted or confirmed.",
  });
}
