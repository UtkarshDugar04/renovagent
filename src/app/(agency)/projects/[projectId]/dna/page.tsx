import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";

const DOMAIN_LABELS: Record<Domain, string> = {
  family: "Family",
  spatial: "Spatial",
  preference: "Preference",
  budget: "Budget",
  constraint: "Constraint",
};

const STATUS_STYLE: Record<string, string> = {
  explicit: "bg-stone-100 text-stone-700",
  verified: "bg-emerald-100 text-emerald-800",
  inferred: "bg-blue-50 text-blue-700",
  assumed: "bg-amber-50 text-amber-700",
  unresolved: "bg-stone-100 text-stone-500",
  conflicted: "bg-red-100 text-red-800",
  stale: "bg-stone-100 text-stone-400 line-through",
  superseded: "bg-stone-100 text-stone-400 line-through",
};

const CONFIDENCE_DOT: Record<string, string> = {
  unknown: "bg-stone-300",
  low: "bg-amber-300",
  medium: "bg-amber-500",
  high: "bg-emerald-500",
};

export default async function ProjectDnaPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: evidence }, { data: constraints }, { data: budgetLines }, { data: conflicts }, { data: assumptions }] =
    await Promise.all([
      supabase
        .from("evidence")
        .select("id, domain, evidence_type, statement, status, confidence, authority, source, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_constraints")
        .select("id, category, hardness, status, description")
        .eq("project_id", projectId),
      supabase
        .from("budget_lines")
        .select("id, category, probable_low, probable_high, estimated, quoted, confirmed, priority_tier")
        .eq("project_id", projectId),
      supabase
        .from("conflicts")
        .select("id, reason, status, evidence_a_id, evidence_b_id")
        .eq("project_id", projectId),
      supabase
        .from("assumptions")
        .select("id, statement, confidence, impact_if_wrong, verification_required, status")
        .eq("project_id", projectId),
    ]);

  const domains: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];

  return (
    <div className="space-y-8">
      {domains.map((domain) => {
        const items = (evidence ?? []).filter((e) => e.domain === domain);
        return (
          <section key={domain}>
            <h2 className="mb-2 text-sm font-semibold text-stone-700">
              {DOMAIN_LABELS[domain]} ({items.length})
            </h2>
            {items.length === 0 ? (
              <p className="text-xs text-stone-400">No evidence yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-400">
                    <th className="pb-1 pr-2 font-medium">Statement</th>
                    <th className="pb-1 pr-2 font-medium">Type</th>
                    <th className="pb-1 pr-2 font-medium">Status</th>
                    <th className="pb-1 pr-2 font-medium">Confidence</th>
                    <th className="pb-1 pr-2 font-medium">Authority</th>
                    <th className="pb-1 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-t border-stone-100">
                      <td className="py-1.5 pr-2 text-stone-800">{e.statement}</td>
                      <td className="py-1.5 pr-2 text-stone-500">{e.evidence_type}</td>
                      <td className="py-1.5 pr-2">
                        <span className={`rounded px-1.5 py-0.5 ${STATUS_STYLE[e.status]}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${CONFIDENCE_DOT[e.confidence]}`}
                          title={e.confidence}
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-stone-500">{e.authority.replace(/^d[0-4]_/, "")}</td>
                      <td className="py-1.5 text-stone-400">{e.source ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">
          Constraints ({constraints?.length ?? 0})
        </h2>
        <ul className="space-y-1">
          {(constraints ?? []).map((c) => (
            <li key={c.id} className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs">
              <span className="font-medium text-stone-700">[{c.hardness}]</span> {c.description}{" "}
              <span className="text-stone-400">— {c.status}</span>
            </li>
          ))}
          {(constraints?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None yet.</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">
          Budget lines ({budgetLines?.length ?? 0})
        </h2>
        <ul className="space-y-1">
          {(budgetLines ?? []).map((b) => (
            <li key={b.id} className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700">
              {b.category} — {b.priority_tier} — probable ₹{b.probable_low ?? "?"}–₹{b.probable_high ?? "?"}
              {b.confirmed && ` — confirmed ₹${b.confirmed}`}
            </li>
          ))}
          {(budgetLines?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None yet.</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">
          Assumptions ({assumptions?.length ?? 0})
        </h2>
        <ul className="space-y-1">
          {(assumptions ?? []).map((a) => (
            <li key={a.id} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              {a.statement} {a.verification_required && "— requires verification"}
              {a.impact_if_wrong && (
                <span className="block text-amber-700">If wrong: {a.impact_if_wrong}</span>
              )}
            </li>
          ))}
          {(assumptions?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None yet.</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">
          Conflicts ({(conflicts ?? []).filter((c) => c.status === "open").length} open)
        </h2>
        <ul className="space-y-1">
          {(conflicts ?? []).map((c) => (
            <li
              key={c.id}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                c.status === "open" ? "border-red-200 bg-red-50 text-red-800" : "border-stone-200 bg-white text-stone-400"
              }`}
            >
              {c.reason} — {c.status}
            </li>
          ))}
          {(conflicts?.length ?? 0) === 0 && <p className="text-xs text-stone-400">None.</p>}
        </ul>
      </section>
    </div>
  );
}
