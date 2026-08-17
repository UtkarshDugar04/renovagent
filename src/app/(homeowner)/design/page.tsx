import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { DesignOptionCard } from "@/components/design/DesignOptionCard";

const DOMAIN_LABELS: Record<Domain, string> = {
  family: "understanding your household",
  spatial: "understanding your home",
  preference: "understanding your preferences",
  budget: "understanding your budget",
  constraint: "understanding what can and can't change",
};

const STATE_COPY: Record<string, string> = {
  not_started: "haven't started",
  discovery_in_progress: "still learning",
  partially_understood: "partly there",
  sufficient_for_validation: "ready to check",
  validated: "ready",
};

export default async function DesignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/");

  const projectId = membership.project_id;

  const { data: readiness } = await supabase
    .from("readiness")
    .select("domain, state, reason")
    .eq("project_id", projectId);

  const allValidated = (readiness ?? []).length === 5 &&
    (readiness ?? []).every((r) => r.state === "validated");

  const { data: meaningConfirmed } = await supabase
    .from("decisions")
    .select("id")
    .eq("project_id", projectId)
    .eq("decision_text", "meaning_verification_confirmed")
    .maybeSingle();

  // Only ever show options that have cleared the second, independent
  // validation pass — visible_to_homeowner is the gate the Knowledge
  // Update Protocol flips, never the raw generation event.
  const { data: options } = await supabase
    .from("design_options")
    .select("id, label, rationale, trade_offs, cost_band, sourcing_status, what_it_would_feel_like, status")
    .eq("project_id", projectId)
    .eq("visible_to_homeowner", true)
    .order("created_at", { ascending: false });

  if (options && options.length > 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-stone-900">Design exploration</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <DesignOptionCard
              key={o.id}
              option={{
                ...o,
                cost_band: o.cost_band as { low: number; high: number; confidence: string } | null,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (allValidated && meaningConfirmed) {
    return (
      <div>
        <h1 className="mb-2 text-lg font-semibold text-stone-900">Design exploration</h1>
        <p className="text-sm text-stone-500">
          Everything&apos;s in place — design options will appear here once Renovagent has
          generated and checked them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Not ready for design yet</h1>
        <p className="text-sm text-stone-500">
          Renovagent explores designs once it has enough to work from — here&apos;s where things
          stand.
        </p>
      </div>
      <ul className="space-y-2">
        {(readiness ?? []).map((r) => (
          <li
            key={r.domain}
            className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          >
            <span className="text-stone-700">{DOMAIN_LABELS[r.domain as Domain]}</span>
            <span className="text-stone-400">{STATE_COPY[r.state] ?? r.state}</span>
          </li>
        ))}
      </ul>
      <a href="/conversation" className="inline-block text-sm underline text-stone-600">
        Continue the conversation
      </a>
    </div>
  );
}
