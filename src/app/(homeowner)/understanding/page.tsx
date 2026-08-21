import { redirect } from "next/navigation";
import { Users, Home, Palette, Wallet, ShieldAlert, FileText, BrainCircuit, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttachmentList } from "@/components/understanding/AttachmentList";
import { EmptyState } from "@/components/shared/EmptyState";

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

  const [{ data: evidence }, { data: attachments }, { data: events }] = await Promise.all([
    supabase
      .from("evidence")
      .select("id, domain, statement, status, confidence")
      .eq("project_id", membership.project_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("id, storage_path, label, mime_type, status, created_at")
      .eq("project_id", membership.project_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, activity_summary, event_type, created_at")
      .eq("project_id", membership.project_id)
      .not("activity_summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Understanding</h1>
        <p className="text-sm text-muted-foreground">
          Everything here comes from what you&apos;ve told us — you can correct anything that&apos;s wrong.
        </p>
      </div>

      <Tabs defaultValue="know" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="know" className="gap-1.5">
            <BrainCircuit className="h-3.5 w-3.5" />
            What we know
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="know" className="space-y-8">
          {attachmentLinks.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Photos & documents
              </h2>
              <AttachmentList
                projectId={membership.project_id}
                initialAttachments={attachmentLinks.map((a) => ({ id: a.id, label: a.label ?? "attachment", url: a.url, status: a.status }))}
              />
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
                      <Card key={e.id}>
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
        </TabsContent>

        <TabsContent value="timeline">
          {(!events || events.length === 0) && (
            <EmptyState icon={History} description="Nothing to show yet." />
          )}
          <ol className="space-y-3 border-l border-border pl-4">
            {(events ?? []).map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm text-foreground/90">{e.activity_summary}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </div>
  );
}
