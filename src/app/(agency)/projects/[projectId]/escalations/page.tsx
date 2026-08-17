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
        <h2 className="text-sm font-semibold text-stone-700">Open ({open?.length ?? 0})</h2>
        {(open ?? []).length === 0 && <p className="text-xs text-stone-400">Nothing open.</p>}
        {(open ?? []).map((e) => (
          <EscalationResolutionForm key={e.id} escalation={e} projectId={projectId} />
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">
          Resolved ({resolved?.length ?? 0})
        </h2>
        <ul className="space-y-1">
          {(resolved ?? []).map((e) => (
            <li key={e.id} className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs">
              <span className="text-stone-500">{e.question ?? e.trigger}</span>
              <span className="ml-2 text-emerald-700">→ {e.resolution}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
