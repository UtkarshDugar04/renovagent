import { LayoutGrid, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { designOptionTone } from "@/lib/status-styles";

export default async function DesignReviewPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: options } = await supabase
    .from("design_options")
    .select(
      "id, label, rationale, status, visible_to_homeowner, sourcing_status, trade_offs, cost_band, created_at, design_round_id"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // The Validation Agent's real findings never land in validation_results —
  // nothing in the Yoxa flow writes to that table (a gap Yoxa's own step
  // instructions flag: there's no tool to link a validation finding to a
  // specific design option). Real findings land as generic `evidence` rows,
  // evidence_type=verification, with the option's id embedded directly in
  // the statement text (confirmed from live data, e.g. "...Round 2 revision
  // (b91507ee-...): NOT VALIDATED..."), which is what we match on here.
  const { data: verificationEvidence } = await supabase
    .from("evidence")
    .select("id, domain, statement, status, created_at")
    .eq("project_id", projectId)
    .eq("evidence_type", "verification")
    .order("created_at", { ascending: false });

  const findingsByOption = new Map<string, typeof verificationEvidence>();
  for (const option of options ?? []) {
    const matches = (verificationEvidence ?? []).filter((e) => e.statement.includes(option.id));
    if (matches.length > 0) findingsByOption.set(option.id, matches);
  }

  if (!options || options.length === 0) {
    return <EmptyState icon={LayoutGrid} description="No design options generated yet." />;
  }

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

  const { data: sourcedProducts } = await supabase
    .from("sourced_products")
    .select("id, design_option_id, vendor_name, product_name, product_url, price, currency, notes")
    .in("design_option_id", options.map((o) => o.id))
    .order("created_at", { ascending: true });

  const productsByOption = new Map<string, typeof sourcedProducts>();
  for (const p of sourcedProducts ?? []) {
    const existing = productsByOption.get(p.design_option_id) ?? [];
    existing.push(p);
    productsByOption.set(p.design_option_id, existing);
  }

  return (
    <div className="space-y-4">
      {options.map((o) => {
        const optionFindings = findingsByOption.get(o.id) ?? [];
        const optionProducts = productsByOption.get(o.id) ?? [];
        return (
          <Card key={o.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{o.label}</CardTitle>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={designOptionTone(o.status)} className="text-xs">
                    {o.status}
                  </StatusBadge>
                  {!o.visible_to_homeowner && (
                    <Badge variant="secondary" className="gap-1 text-xs font-normal">
                      <EyeOff className="h-3 w-3" />
                      hidden from homeowner
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(imagesByOption.get(o.id) ?? []).length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(imagesByOption.get(o.id) ?? []).map((img) => (
                    <figure key={img.id} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL */}
                      <img
                        src={img.url}
                        alt={img.angle ?? o.label}
                        className="h-32 w-44 rounded-lg border border-border object-cover"
                      />
                      {img.angle && (
                        <figcaption className="mt-1 text-[10px] text-muted-foreground">{img.angle}</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{o.rationale}</p>
              <p className="text-xs text-muted-foreground/70">
                Sourcing: {o.sourcing_status.replace(/_/g, " ")}
              </p>

              {optionProducts.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <p className="text-xs font-medium text-foreground/80">Sourced from</p>
                  {optionProducts.map((p) => (
                    <div key={p!.id} className="text-xs text-muted-foreground">
                      <span className="text-foreground/90">{p!.vendor_name}</span>
                      {" · "}
                      {p!.product_url ? (
                        <a href={p!.product_url} target="_blank" rel="noreferrer" className="text-accent underline">
                          {p!.product_name}
                        </a>
                      ) : (
                        <span>{p!.product_name}</span>
                      )}
                      {p!.price != null && (
                        <span className="ml-1">
                          — {p!.currency} {p!.price.toLocaleString("en-IN")}
                        </span>
                      )}
                      {p!.notes && <p className="mt-0.5 text-muted-foreground/70">{p!.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              {optionFindings.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <p className="text-xs font-medium text-foreground/80">Validation findings</p>
                  {optionFindings.map((f) => (
                    <div key={f!.id} className="text-xs text-muted-foreground">
                      <span
                        className={
                          f!.status === "verified" ? "text-accent" : "text-destructive"
                        }
                      >
                        {(f!.status ?? "unresolved").replace(/_/g, " ")} · {f!.domain}
                      </span>
                      <p className="mt-0.5">{f!.statement}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
