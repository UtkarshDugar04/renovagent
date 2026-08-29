import Link from "next/link";
import { FolderOpen, ChevronRight, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function ProjectListPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, phase, scope_summary, created_at")
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: openQuestions }, { data: readiness }, { data: sentRuns }] =
    projectIds.length > 0
      ? await Promise.all([
          supabase
            .from("questions")
            .select("project_id")
            .in("project_id", projectIds)
            .eq("status", "open"),
          supabase
            .from("readiness")
            .select("project_id, state")
            .in("project_id", projectIds),
          supabase
            .from("workflow_runs")
            .select("project_id")
            .in("project_id", projectIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const sentProjectIds = new Set((sentRuns ?? []).map((r) => r.project_id));

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
        <EmptyState icon={FolderOpen} description="No projects yet." />
      )}

      <div className="space-y-2">
        {(projects ?? []).map((p) => {
          const questionCount = countFor(openQuestions, p.id);

          return (
            <Link key={p.id} href={`/projects/${p.id}/overview`}>
              <Card className="transition-colors hover:bg-muted/50">
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
                    {sentProjectIds.has(p.id) && (
                      <Badge className="gap-1 bg-accent/10 text-xs font-normal text-accent">
                        <Send className="h-3 w-3" />
                        Sent to Yoxa
                      </Badge>
                    )}
                    {questionCount > 0 && (
                      <Badge className="bg-primary/10 text-xs text-primary">
                        {questionCount} open
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
