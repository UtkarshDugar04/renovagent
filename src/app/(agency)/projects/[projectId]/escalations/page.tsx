import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HitlRequestCard, type HitlOption } from "@/components/decisions/HitlRequestCard";
import { RenovationDnaSnapshot } from "@/components/decisions/RenovationDnaSnapshot";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function EscalationsPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: hitlRequests }, { data: answeredHitlRequests }] = await Promise.all([
    supabase
      .from("yoxa_hitl_requests")
      .select("id, title, description, options")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("yoxa_hitl_requests")
      .select("id, title, options, selected_option_id, override_message, answered_at")
      .eq("project_id", projectId)
      .eq("status", "answered")
      .order("answered_at", { ascending: false }),
  ]);

  function describeHitlResponse(request: {
    options: unknown;
    selected_option_id: string | null;
    override_message: string | null;
  }): string {
    if (request.override_message) return request.override_message;
    const options = Array.isArray(request.options) ? (request.options as { optionId?: string; title?: string }[]) : [];
    const matched = options.find((o) => o.optionId === request.selected_option_id);
    return matched?.title ?? request.selected_option_id ?? "Answered";
  }

  const hasAnything = (hitlRequests?.length ?? 0) > 0 || (answeredHitlRequests?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {(hitlRequests ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground/90">
            Renovagent needs a decision ({hitlRequests?.length ?? 0})
          </h2>
          <RenovationDnaSnapshot projectId={projectId} />
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

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">
          Resolved ({answeredHitlRequests?.length ?? 0})
        </h2>
        {!hasAnything && (
          <EmptyState icon={CheckCircle2} iconClassName="text-accent" description="Nothing waiting on a decision right now." />
        )}
        <div className="space-y-2">
          {(answeredHitlRequests ?? []).map((r) => (
            <div key={r.id} className="space-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <div>
                <span className="text-muted-foreground">{r.title}</span>
                <span className="ml-2 text-accent">→ {describeHitlResponse(r)}</span>
              </div>
              <p className="text-muted-foreground/70">
                See Design Review and Renovation DNA for how this fed into the next round.
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
