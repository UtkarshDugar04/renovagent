import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";

const DOMAIN_LABELS: Record<Domain, string> = {
  family: "Family",
  spatial: "Home",
  preference: "Preferences",
  budget: "Budget",
  constraint: "Constraints",
};

const STATUS_COPY: Record<string, string> = {
  explicit: "you told us",
  verified: "confirmed",
  inferred: "we think, based on what you've said",
  assumed: "we're assuming for now",
  unresolved: "still unknown",
  conflicted: "conflicting information",
  stale: "may be out of date",
  superseded: "replaced by newer information",
};

export default async function UnderstandingPage() {
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

  const { data: evidence } = await supabase
    .from("evidence")
    .select("id, domain, statement, status, confidence")
    .eq("project_id", membership.project_id)
    .order("created_at", { ascending: false });

  const domains: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];
  const grouped = Object.fromEntries(
    domains.map((d) => [d, (evidence ?? []).filter((e) => e.domain === d)])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">What Renovagent understands</h1>
        <p className="text-sm text-stone-500">
          Everything here comes from what you&apos;ve told us — you can correct anything that&apos;s wrong.
        </p>
      </div>

      {domains.map((domain) => (
        <section key={domain}>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">{DOMAIN_LABELS[domain]}</h2>
          {grouped[domain].length === 0 ? (
            <p className="text-sm text-stone-400">Nothing yet — this will fill in as we talk.</p>
          ) : (
            <ul className="space-y-1.5">
              {grouped[domain].map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  {e.statement}
                  <span className="ml-2 text-xs text-stone-400">
                    ({STATUS_COPY[e.status] ?? e.status})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
