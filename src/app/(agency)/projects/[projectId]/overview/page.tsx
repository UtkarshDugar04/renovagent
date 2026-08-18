import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DOMAIN_LABELS: Record<Domain, string> = {
  family: "Family",
  spatial: "Spatial",
  preference: "Preference",
  budget: "Budget",
  constraint: "Constraint",
};

const STATE_STYLE: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  discovery_in_progress: "bg-muted text-muted-foreground",
  partially_understood: "bg-accent/10 text-accent",
  sufficient_for_validation: "bg-primary/10 text-primary",
  validated: "bg-accent/15 text-accent",
};

export default async function ProjectOverviewPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [
    { data: readiness },
    { data: openQuestions },
    { data: openConflicts },
    { data: openEscalations },
    { data: recentEvents },
    { data: project },
  ] = await Promise.all([
    supabase.from("readiness").select("domain, state, reason").eq("project_id", projectId),
    supabase
      .from("questions")
      .select("id, question_text, severity")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("severity", { ascending: false }),
    supabase
      .from("conflicts")
      .select("id, reason")
      .eq("project_id", projectId)
      .eq("status", "open"),
    supabase
      .from("escalations")
      .select("id, question, trigger, required_authority")
      .eq("project_id", projectId)
      .eq("status", "open"),
    supabase
      .from("events")
      .select("id, activity_summary, created_at")
      .eq("project_id", projectId)
      .not("activity_summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("budget_comfortable_low, budget_comfortable_high, scope_summary")
      .eq("id", projectId)
      .single(),
  ]);

  const domains: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];
  const readinessByDomain = Object.fromEntries((readiness ?? []).map((r) => [r.domain, r]));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">Readiness</h2>
        <div className="grid grid-cols-5 gap-2">
          {domains.map((d) => {
            const r = readinessByDomain[d];
            return (
              <Card
                key={d}
                className={`glass border-0 text-center ${STATE_STYLE[r?.state ?? "not_started"]}`}
                title={r?.reason ?? ""}
              >
                <CardContent className="px-2 py-3">
                  <p className="text-xs font-medium">{DOMAIN_LABELS[d]}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">
                    {(r?.state ?? "not_started").replace(/_/g, " ")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {project?.scope_summary && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-foreground/90">Scope</h2>
          <p className="text-sm text-muted-foreground">{project.scope_summary}</p>
          {(project.budget_comfortable_low || project.budget_comfortable_high) && (
            <p className="text-xs text-muted-foreground/70">
              Comfortable budget: ₹{project.budget_comfortable_low?.toLocaleString()}–₹
              {project.budget_comfortable_high?.toLocaleString()}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <section>
          <h2 className="mb-2 text-sm font-medium text-foreground/90">
            Open questions ({openQuestions?.length ?? 0})
          </h2>
          <div className="space-y-1">
            {(openQuestions ?? []).map((q) => (
              <Card key={q.id} className="glass border-0">
                <CardContent className="px-3 py-2 text-xs">{q.question_text}</CardContent>
              </Card>
            ))}
            {(openQuestions?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">None</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-foreground/90">
            Unresolved conflicts ({openConflicts?.length ?? 0})
          </h2>
          <div className="space-y-1">
            {(openConflicts ?? []).map((c) => (
              <Card key={c.id} className="glass border-destructive/20">
                <CardContent className="px-3 py-2 text-xs text-destructive">
                  {c.reason}
                </CardContent>
              </Card>
            ))}
            {(openConflicts?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">None</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-foreground/90">
            Escalations ({openEscalations?.length ?? 0})
          </h2>
          <div className="space-y-1">
            {(openEscalations ?? []).map((e) => (
              <Card key={e.id} className="glass border-accent/20">
                <CardContent className="px-3 py-2 text-xs text-accent-foreground">
                  {e.question ?? e.trigger}{" "}
                  <Badge variant="secondary" className="ml-1 text-[10px] font-normal">
                    needs {e.required_authority.replace("d3_", "").replace("d4_", "")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {(openEscalations?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">None</p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">Recent activity</h2>
        <ul className="space-y-1.5">
          {(recentEvents ?? []).map((e) => (
            <li key={e.id} className="text-xs text-muted-foreground">
              <span className="text-foreground/80">{e.activity_summary}</span>{" "}
              — {new Date(e.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
