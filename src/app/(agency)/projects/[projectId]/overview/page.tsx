import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";

const DOMAIN_LABELS: Record<Domain, string> = {
  family: "Family",
  spatial: "Spatial",
  preference: "Preference",
  budget: "Budget",
  constraint: "Constraint",
};

const STATE_STYLE: Record<string, string> = {
  not_started: "bg-stone-100 text-stone-500",
  discovery_in_progress: "bg-stone-100 text-stone-600",
  partially_understood: "bg-amber-50 text-amber-700",
  sufficient_for_validation: "bg-blue-50 text-blue-700",
  validated: "bg-emerald-50 text-emerald-700",
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
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Readiness</h2>
        <div className="grid grid-cols-5 gap-2">
          {domains.map((d) => {
            const r = readinessByDomain[d];
            return (
              <div
                key={d}
                className={`rounded-lg px-2 py-2 text-center text-xs ${STATE_STYLE[r?.state ?? "not_started"]}`}
                title={r?.reason ?? ""}
              >
                <p className="font-medium">{DOMAIN_LABELS[d]}</p>
                <p className="mt-0.5">{(r?.state ?? "not_started").replace(/_/g, " ")}</p>
              </div>
            );
          })}
        </div>
      </section>

      {project?.scope_summary && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-stone-700">Scope</h2>
          <p className="text-sm text-stone-600">{project.scope_summary}</p>
          {(project.budget_comfortable_low || project.budget_comfortable_high) && (
            <p className="text-xs text-stone-400">
              Comfortable budget: ₹{project.budget_comfortable_low?.toLocaleString()}–₹
              {project.budget_comfortable_high?.toLocaleString()}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            Open questions ({openQuestions?.length ?? 0})
          </h2>
          <ul className="space-y-1">
            {(openQuestions ?? []).map((q) => (
              <li key={q.id} className="rounded-md bg-white border border-stone-200 px-2 py-1.5 text-xs text-stone-700">
                {q.question_text}
              </li>
            ))}
            {(openQuestions?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None</p>}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            Unresolved conflicts ({openConflicts?.length ?? 0})
          </h2>
          <ul className="space-y-1">
            {(openConflicts ?? []).map((c) => (
              <li key={c.id} className="rounded-md bg-white border border-red-200 px-2 py-1.5 text-xs text-red-700">
                {c.reason}
              </li>
            ))}
            {(openConflicts?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None</p>}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            Escalations ({openEscalations?.length ?? 0})
          </h2>
          <ul className="space-y-1">
            {(openEscalations ?? []).map((e) => (
              <li key={e.id} className="rounded-md bg-white border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
                {e.question ?? e.trigger} — needs {e.required_authority.replace("d3_", "").replace("d4_", "")}
              </li>
            ))}
            {(openEscalations?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None</p>}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Recent activity</h2>
        <ul className="space-y-1.5">
          {(recentEvents ?? []).map((e) => (
            <li key={e.id} className="text-xs text-stone-500">
              <span className="text-stone-700">{e.activity_summary}</span>{" "}
              — {new Date(e.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
