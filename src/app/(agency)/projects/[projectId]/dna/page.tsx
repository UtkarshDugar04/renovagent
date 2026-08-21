import { Users, Home, Palette, Wallet, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { evidenceStatusTone } from "@/lib/status-styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DOMAIN_META: Record<Domain, { label: string; icon: React.ElementType }> = {
  family: { label: "Family", icon: Users },
  spatial: { label: "Spatial", icon: Home },
  preference: { label: "Preference", icon: Palette },
  budget: { label: "Budget", icon: Wallet },
  constraint: { label: "Constraint", icon: ShieldAlert },
};

const CONFIDENCE_DOT: Record<string, string> = {
  unknown: "bg-muted-foreground/40",
  low: "bg-accent/50",
  medium: "bg-accent/80",
  high: "bg-accent",
};

export default async function ProjectDnaPage({
  params,
}: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: evidence }, { data: constraints }, { data: budgetLines }, { data: conflicts }, { data: assumptions }, { data: artifacts }] =
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
      supabase
        .from("project_artifacts")
        .select("id, engine, artifact_type, content, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

  const domains: Domain[] = ["family", "spatial", "preference", "budget", "constraint"];

  // Latest artifact per (engine, artifact_type) — artifacts are append-only,
  // so an engine re-running produces a new row rather than updating one.
  const latestArtifacts = new Map<string, (typeof artifacts extends (infer T)[] | null ? T : never)>();
  for (const artifact of artifacts ?? []) {
    const key = `${artifact.engine}:${artifact.artifact_type}`;
    if (!latestArtifacts.has(key)) latestArtifacts.set(key, artifact);
  }

  return (
    <div className="space-y-8">
      {domains.map((domain) => {
        const items = (evidence ?? []).filter((e) => e.domain === domain);
        const Icon = DOMAIN_META[domain].icon;
        const domainArtifacts = [...latestArtifacts.values()].filter((a) => a.engine === domain);
        return (
          <section key={domain}>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground/90">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {DOMAIN_META[domain].label} ({items.length})
            </h2>
            {domainArtifacts.map((artifact) => (
              <div key={artifact.id} className="mb-3 overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{artifact.artifact_type}</span>
                  <span>{new Date(artifact.created_at).toLocaleString()}</span>
                </div>
                {/* Agent-generated HTML — never trusted with script execution.
                    Empty sandbox = every iframe privilege denied: no scripts,
                    no forms, no same-origin access, nothing. Fixed height
                    since a locked-down iframe can't safely postMessage its
                    content size back to the parent for auto-resize. */}
                <iframe
                  srcDoc={artifact.content}
                  sandbox=""
                  className="h-[420px] w-full border-0 bg-white"
                  title={`${DOMAIN_META[domain].label} — ${artifact.artifact_type}`}
                />
              </div>
            ))}
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">No evidence yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Statement</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Authority</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((e) => (
                      <TableRow key={e.id} className="border-border hover:bg-muted/50">
                        <TableCell className="text-foreground/90">{e.statement}</TableCell>
                        <TableCell className="text-muted-foreground">{e.evidence_type}</TableCell>
                        <TableCell>
                          <StatusBadge
                            tone={evidenceStatusTone(e.status)}
                            className={
                              e.status === "stale" || e.status === "superseded" ? "text-[10px] line-through" : "text-[10px]"
                            }
                          >
                            {e.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${CONFIDENCE_DOT[e.confidence]}`}
                            title={e.confidence}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.authority.replace(/^d[0-4]_/, "")}
                        </TableCell>
                        <TableCell className="text-muted-foreground/70">{e.source ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        );
      })}

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">
          Constraints ({constraints?.length ?? 0})
        </h2>
        <div className="space-y-1">
          {(constraints ?? []).map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <Badge variant="secondary" className="mr-1.5 text-[10px] font-normal">
                {c.hardness}
              </Badge>
              {c.description} <span className="text-muted-foreground">— {c.status}</span>
            </div>
          ))}
          {(constraints?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">None yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">
          Budget lines ({budgetLines?.length ?? 0})
        </h2>
        <div className="space-y-1">
          {(budgetLines ?? []).map((b) => (
            <div key={b.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground/90">
              {b.category} — {b.priority_tier} — probable ₹{b.probable_low ?? "?"}–₹{b.probable_high ?? "?"}
              {b.confirmed && ` — confirmed ₹${b.confirmed}`}
            </div>
          ))}
          {(budgetLines?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">None yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">
          Assumptions ({assumptions?.length ?? 0})
        </h2>
        <div className="space-y-1">
          {(assumptions ?? []).map((a) => (
            <div key={a.id} className="rounded-lg border border-primary/20 bg-card px-3 py-2 text-xs">
              {a.statement} {a.verification_required && "— requires verification"}
              {a.impact_if_wrong && (
                <span className="block text-muted-foreground">If wrong: {a.impact_if_wrong}</span>
              )}
            </div>
          ))}
          {(assumptions?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">None yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/90">
          Conflicts ({(conflicts ?? []).filter((c) => c.status === "open").length} open)
        </h2>
        <div className="space-y-1">
          {(conflicts ?? []).map((c) => (
            <div
              key={c.id}
              className={`rounded-lg px-3 py-2 text-xs ${
                c.status === "open"
                  ? "border border-destructive/30 bg-destructive/10 text-destructive"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {c.reason} — {c.status}
            </div>
          ))}
          {(conflicts?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">None.</p>}
        </div>
      </section>
    </div>
  );
}
