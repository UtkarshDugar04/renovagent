import { LayoutGrid, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-primary/10 text-primary",
  validated: "bg-accent/15 text-accent",
  rejected: "bg-destructive/10 text-destructive",
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
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No design options generated yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {options.map((o) => {
        const optionValidations = validationsByTarget.get(o.id) ?? [];
        return (
          <Card key={o.id} className="glass border-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{o.label}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs font-normal ${STATUS_STYLE[o.status]}`}>
                    {o.status}
                  </Badge>
                  {!o.visible_to_homeowner && (
                    <Badge variant="secondary" className="gap-1 text-xs font-normal">
                      <EyeOff className="h-3 w-3" />
                      hidden from homeowner
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{o.rationale}</p>
              <p className="text-xs text-muted-foreground/70">
                Sourcing: {o.sourcing_status.replace(/_/g, " ")}
              </p>

              {optionValidations.length > 0 && (
                <div className="space-y-1 border-t border-white/10 pt-2">
                  <p className="text-xs font-medium text-foreground/80">Validation history</p>
                  {optionValidations.map((v) => (
                    <div key={v!.id} className="text-xs text-muted-foreground">
                      <span className={v!.result === "pass" ? "text-accent" : "text-destructive"}>
                        {v!.result}
                      </span>
                      {v!.human_decision_required && (
                        <span className="ml-1 text-primary">— human decision required</span>
                      )}
                      {Array.isArray(v!.failed_criteria) && v!.failed_criteria.length > 0 && (
                        <ul className="ml-3 list-disc text-destructive/80">
                          {(v!.failed_criteria as { criterion: string }[]).map((f, i) => (
                            <li key={i}>{f.criterion}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
