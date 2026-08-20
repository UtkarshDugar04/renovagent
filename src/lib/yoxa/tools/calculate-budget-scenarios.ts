import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError } from "./errors";

export interface CategoryEstimateInput {
  category: string;
  estimated: number;
}

export interface CalculateBudgetScenariosInput {
  contingencyPercent?: number;
  categoryEstimates?: CategoryEstimateInput[];
}

// Shared logic behind calculateBudgetScenarios — the Sourcing Agent's real
// budget cross-check. Deliberately a pure, deterministic calculation over
// real budget_lines rows and the project's own ceiling — never an LLM
// guess at a price. Writes nothing; hypothetical categoryEstimates are used
// only for this one calculation. See get-canonical-renovation-dna.ts for
// why this lives separately from the route handlers that call it.
export async function calculateBudgetScenarios(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  input: CalculateBudgetScenariosInput
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("budget_ceiling, budget_comfortable_low, budget_comfortable_high, budget_stretch_high")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new ToolError(500, projectError.message);
  if (!project) throw new ToolError(404, "Project not found");

  const { data: budgetLines, error: linesError } = await supabase
    .from("budget_lines")
    .select("category, probable_low, probable_high, estimated, quoted, confirmed")
    .eq("project_id", projectId);
  if (linesError) throw new ToolError(500, linesError.message);

  const contingencyPercent = typeof input.contingencyPercent === "number" ? input.contingencyPercent : 10;
  const hypotheticalEstimates = input.categoryEstimates ?? [];

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

  return {
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
  };
}
