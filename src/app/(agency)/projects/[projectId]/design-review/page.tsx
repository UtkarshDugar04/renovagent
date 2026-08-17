import { createClient } from "@/lib/supabase/server";

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-amber-50 text-amber-700",
  validated: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export default async function DesignReviewPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: options } = await supabase
    .from("design_options")
    .select(
      "id, label, rationale, status, visible_to_homeowner, sourcing_status, trade_offs, cost_band, created_at, design_round_id"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: validations } = await supabase
    .from("validation_results")
    .select("id, mode, target_id, result, failed_criteria, unresolved_risks, human_decision_required, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const validationsByTarget = new Map<string, typeof validations>();
  for (const v of validations ?? []) {
    if (!v.target_id) continue;
    const existing = validationsByTarget.get(v.target_id) ?? [];
    existing.push(v);
    validationsByTarget.set(v.target_id, existing);
  }

  if (!options || options.length === 0) {
    return <p className="text-sm text-stone-400">No design options generated yet.</p>;
  }

  return (
    <div className="space-y-4">
      {options.map((o) => {
        const optionValidations = validationsByTarget.get(o.id) ?? [];
        return (
          <div key={o.id} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">{o.label}</h3>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                {!o.visible_to_homeowner && (
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                    hidden from homeowner
                  </span>
                )}
              </div>
            </div>
            <p className="mb-2 text-xs text-stone-600">{o.rationale}</p>
            <p className="mb-2 text-xs text-stone-400">
              Sourcing: {o.sourcing_status.replace(/_/g, " ")}
            </p>

            {optionValidations.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-stone-100 pt-2">
                <p className="text-xs font-medium text-stone-600">Validation history</p>
                {optionValidations.map((v) => (
                  <div key={v!.id} className="text-xs text-stone-500">
                    <span className={v!.result === "pass" ? "text-emerald-600" : "text-red-600"}>
                      {v!.result}
                    </span>
                    {v!.human_decision_required && (
                      <span className="ml-1 text-blue-600">— human decision required</span>
                    )}
                    {Array.isArray(v!.failed_criteria) && v!.failed_criteria.length > 0 && (
                      <ul className="ml-3 list-disc text-red-500">
                        {(v!.failed_criteria as { criterion: string }[]).map((f, i) => (
                          <li key={i}>{f.criterion}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
