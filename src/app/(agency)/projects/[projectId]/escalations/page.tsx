import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EscalationResolutionForm } from "@/components/decisions/EscalationResolutionForm";
import { HitlRequestCard, type HitlOption } from "@/components/decisions/HitlRequestCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function EscalationsPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: open }, { data: resolved }, { data: hitlRequests }] = await Promise.all([
    supabase
      .from("escalations")
      .select("id, trigger, question, required_authority, severity")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("severity", { ascending: false }),
    supabase
      .from("escalations")
      .select("id, trigger, question, resolution, resolved_at")
      .eq("project_id", projectId)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false }),
    supabase
      .from("yoxa_hitl_requests")
      .select("id, title, description, options")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      {(hitlRequests ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground/90">
            Renovagent needs a decision ({hitlRequests?.length ?? 0})
          </h2>
          {(hitlRequests ?? []).map((r) => (
            <HitlRequestCard
              key={r.id}
              projectId={projectId}
              request={{
                id: r.id,
                title: r.title,
                description: r.description,
                options: Array.isArray(r.options) ? (r.options as unknown as HitlOption[]) : [],
              }}
            />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground/90">Open ({open?.length ?? 0})</h2>
        {(open ?? []).length === 0 && (
          <EmptyState icon={ShieldCheck} iconClassName="text-accent" description="Nothing open." />
        )}
        {(open ?? []).map((e) => (
          <EscalationResolutionForm key={e.id} escalation={e} projectId={projectId} />
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">
          Resolved ({resolved?.length ?? 0})
        </h2>
        <div className="space-y-1">
          {(resolved ?? []).map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <span className="text-muted-foreground">{e.question ?? e.trigger}</span>
              <span className="ml-2 text-accent">→ {e.resolution}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
