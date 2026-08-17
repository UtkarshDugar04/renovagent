import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectListPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, phase, scope_summary, created_at")
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: openEscalations }, { data: openQuestions }, { data: readiness }] =
    projectIds.length > 0
      ? await Promise.all([
          supabase
            .from("escalations")
            .select("project_id")
            .in("project_id", projectIds)
            .eq("status", "open"),
          supabase
            .from("questions")
            .select("project_id")
            .in("project_id", projectIds)
            .eq("status", "open"),
          supabase
            .from("readiness")
            .select("project_id, state")
            .in("project_id", projectIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  function countFor(rows: { project_id: string }[] | null, projectId: string) {
    return (rows ?? []).filter((r) => r.project_id === projectId).length;
  }

  function readinessSummary(projectId: string) {
    const rows = (readiness ?? []).filter((r) => r.project_id === projectId);
    if (rows.length === 0) return "Not started";
    const validated = rows.filter((r) => r.state === "validated").length;
    return `${validated}/5 domains ready`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-stone-900">Projects</h1>

      {(!projects || projects.length === 0) && (
        <p className="text-sm text-stone-400">No projects yet.</p>
      )}

      <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {(projects ?? []).map((p) => {
          const escalationCount = countFor(openEscalations, p.id);
          const questionCount = countFor(openQuestions, p.id);

          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}/overview`}
              className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{p.name}</p>
                <p className="text-xs text-stone-500">{p.scope_summary ?? "No summary yet"}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-stone-400">{readinessSummary(p.id)}</span>
                {questionCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                    {questionCount} open
                  </span>
                )}
                {escalationCount > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                    {escalationCount} escalation{escalationCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
