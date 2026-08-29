import Link from "next/link";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { Card, CardContent } from "@/components/ui/card";
import { readinessTone, TONE_CLASSES } from "@/lib/status-styles";
import { backfillConversationBrief } from "./actions";

const DOMAIN_LABELS: Record<Domain, string> = {
  family: "Family",
  spatial: "Spatial",
  preference: "Preference",
  budget: "Budget",
  constraint: "Constraint",
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
    { data: recentEvents },
    { data: project },
    { data: yoxaRun },
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
    supabase
      .from("workflow_runs")
      .select("workflow_run_id, created_at")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  const domains: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];
  const readinessByDomain = Object.fromEntries((readiness ?? []).map((r) => [r.domain, r]));

  // Absent for projects sent before send-to-yoxa.ts started storing this —
  // the banner below falls back to an on-demand "Generate conversation
  // brief" action (actions.ts) for those instead of just hiding the link.
  let conversationBriefUrl: string | null = null;
  if (yoxaRun) {
    const { data: signed } = await supabase.storage
      .from("project-attachments")
      .createSignedUrl(`${projectId}/conversation-brief.pdf`, 3600);
    conversationBriefUrl = signed?.signedUrl ?? null;
  }

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
                className={`border-0 text-center ${TONE_CLASSES[readinessTone(r?.state ?? "not_started")]}`}
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

      <section>
        {yoxaRun ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-accent">
            <span className="flex items-center gap-2">
              <Send className="h-4 w-4 shrink-0" />
              Sent to Yoxa on {new Date(yoxaRun.created_at).toLocaleDateString()} — planning and design work is underway.
            </span>
            {conversationBriefUrl ? (
              <a
                href={conversationBriefUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs underline underline-offset-2"
              >
                Download conversation brief
              </a>
            ) : (
              <form action={backfillConversationBrief.bind(null, projectId)} className="shrink-0">
                <button type="submit" className="text-xs underline underline-offset-2">
                  Generate conversation brief
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
            <span>Not yet sent to Yoxa.</span>
            <Link href={`/projects/${projectId}/call`} className="text-primary underline underline-offset-2">
              Go to the call tab
            </Link>
          </div>
        )}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium text-foreground/90">
            Open questions ({openQuestions?.length ?? 0})
          </h2>
          <div className="space-y-1">
            {(openQuestions ?? []).map((q) => (
              <Card key={q.id}>
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
              <Card key={c.id} className="border-destructive/20 bg-destructive/5">
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
