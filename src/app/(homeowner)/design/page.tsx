import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { DesignOptionCard } from "@/components/design/DesignOptionCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { readinessTone } from "@/lib/status-styles";

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

  const { data: options } = await supabase
    .from("design_options")
    .select("id, label, rationale, trade_offs, cost_band, sourcing_status, what_it_would_feel_like, status")
    .eq("project_id", projectId)
    .eq("visible_to_homeowner", true)
    .order("created_at", { ascending: false });

  if (options && options.length > 0) {
    const { data: optionImages } = await supabase
      .from("design_option_images")
      .select("id, design_option_id, storage_path, angle")
      .in("design_option_id", options.map((o) => o.id));

    const imagesByOption = new Map<string, { id: string; url: string; angle: string | null }[]>();
    for (const img of optionImages ?? []) {
      const { data } = await supabase.storage.from("project-attachments").createSignedUrl(img.storage_path, 3600);
      const entry = { id: img.id, url: data?.signedUrl ?? "", angle: img.angle };
      const existing = imagesByOption.get(img.design_option_id) ?? [];
      existing.push(entry);
      imagesByOption.set(img.design_option_id, existing);
    }

    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Design exploration</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <DesignOptionCard
              key={o.id}
              projectId={projectId}
              option={{
                ...o,
                cost_band: o.cost_band as { low: number; high: number; confidence: string } | null,
                images: imagesByOption.get(o.id) ?? [],
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
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Design exploration</h1>
        <EmptyState
          icon={LayoutGrid}
          iconClassName="text-primary"
          description="Everything's in place — design options will appear here once Renovagent has generated and checked them."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Not ready for design yet</h1>
        <p className="text-sm text-muted-foreground">
          Renovagent explores designs once it has enough to work from — here&apos;s where things
          stand.
        </p>
      </div>
      <div className="space-y-1.5">
        {(readiness ?? []).map((r) => (
          <Card key={r.domain}>
            <CardContent className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">{DOMAIN_LABELS[r.domain as Domain]}</span>
              <StatusBadge tone={readinessTone(r.state)}>
                {STATE_COPY[r.state] ?? r.state}
              </StatusBadge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="outline" render={<Link href="/conversation" />}>
        Continue the conversation
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
