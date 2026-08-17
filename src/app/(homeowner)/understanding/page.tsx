import { redirect } from "next/navigation";
import { Users, Home, Palette, Wallet, ShieldAlert, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const DOMAIN_META: Record<Domain, { label: string; icon: React.ElementType }> = {
  family: { label: "Family", icon: Users },
  spatial: { label: "Home", icon: Home },
  preference: { label: "Preferences", icon: Palette },
  budget: { label: "Budget", icon: Wallet },
  constraint: { label: "Constraints", icon: ShieldAlert },
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

  const { data: attachments } = await supabase
    .from("attachments")
    .select("id, storage_path, label, mime_type, created_at")
    .eq("project_id", membership.project_id)
    .order("created_at", { ascending: false });

  const attachmentLinks = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from("project-attachments")
        .createSignedUrl(a.storage_path, 60 * 60);
      return { ...a, url: data?.signedUrl ?? null };
    })
  );

  const domains: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];
  const grouped = Object.fromEntries(
    domains.map((d) => [d, (evidence ?? []).filter((e) => e.domain === d)])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">What Renovagent understands</h1>
        <p className="text-sm text-muted-foreground">
          Everything here comes from what you&apos;ve told us — you can correct anything that&apos;s wrong.
        </p>
      </div>

      {attachmentLinks.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground/90">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Photos & documents
          </h2>
          <div className="flex flex-wrap gap-2">
            {attachmentLinks.map((a) => (
              <a
                key={a.id}
                href={a.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="glass rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {a.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {domains.map((domain) => {
        const Icon = DOMAIN_META[domain].icon;
        return (
          <section key={domain}>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground/90">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {DOMAIN_META[domain].label}
            </h2>
            {grouped[domain].length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet — this will fill in as we talk.
              </p>
            ) : (
              <div className="space-y-1.5">
                {grouped[domain].map((e) => (
                  <Card key={e.id} className="glass border-0">
                    <CardContent className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm">{e.statement}</span>
                      <Badge variant="secondary" className="ml-3 shrink-0 text-xs font-normal">
                        {STATUS_COPY[e.status] ?? e.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
