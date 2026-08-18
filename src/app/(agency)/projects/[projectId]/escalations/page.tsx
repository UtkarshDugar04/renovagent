import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EscalationResolutionForm } from "@/components/decisions/EscalationResolutionForm";

export default async function EscalationsPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: open }, { data: resolved }] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground/90">Open ({open?.length ?? 0})</h2>
        {(open ?? []).length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-8 text-center">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <p className="text-xs text-muted-foreground">Nothing open.</p>
          </div>
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
            <div key={e.id} className="glass rounded-lg px-3 py-2 text-xs">
              <span className="text-muted-foreground">{e.question ?? e.trigger}</span>
              <span className="ml-2 text-accent">→ {e.resolution}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
