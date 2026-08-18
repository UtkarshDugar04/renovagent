import Link from "next/link";
import { FolderOpen, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
      <h1 className="text-lg font-semibold tracking-tight">Projects</h1>

      {(!projects || projects.length === 0) && (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {(projects ?? []).map((p) => {
          const escalationCount = countFor(openEscalations, p.id);
          const questionCount = countFor(openQuestions, p.id);

          return (
            <Link key={p.id} href={`/projects/${p.id}/overview`}>
              <Card className="glass border-0 transition-colors hover:bg-white/5">
                <CardContent className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.scope_summary ?? "No summary yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {readinessSummary(p.id)}
                    </span>
                    {questionCount > 0 && (
                      <Badge className="bg-primary/10 text-xs text-primary">
                        {questionCount} open
                      </Badge>
                    )}
                    {escalationCount > 0 && (
                      <Badge className="bg-destructive/10 text-xs text-destructive">
                        {escalationCount} escalation{escalationCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
