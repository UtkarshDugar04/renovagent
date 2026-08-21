import { Users, Home, Palette, Wallet, ShieldAlert, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Domain } from "@/lib/types/domain";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { evidenceStatusTone } from "@/lib/status-styles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type EvidenceRow = {
  id: string;
  domain: string;
  evidence_type: string;
  statement: string;
  status: string;
  confidence: string;
  authority: string;
  source: string | null;
};

function EvidenceTable({ items }: { items: EvidenceRow[] }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">No evidence yet.</p>;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
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
              <TableCell className="text-muted-foreground">{e.authority.replace(/^d[0-4]_/, "")}</TableCell>
              <TableCell className="text-muted-foreground/70">{e.source ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
    <Tabs defaultValue="family" className="gap-4">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
        {domains.map((domain) => {
          const Icon = DOMAIN_META[domain].icon;
          const count = (evidence ?? []).filter((e) => e.domain === domain).length;
          return (
            <TabsTrigger key={domain} value={domain} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {DOMAIN_META[domain].label} ({count})
            </TabsTrigger>
          );
        })}
        <TabsTrigger value="other" className="gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Other ({(assumptions?.length ?? 0) + (conflicts?.length ?? 0)})
        </TabsTrigger>
      </TabsList>

      {domains.map((domain) => {
        const items = (evidence ?? []).filter((e) => e.domain === domain);
        const domainArtifacts = [...latestArtifacts.values()].filter((a) => a.engine === domain);
        return (
          <TabsContent key={domain} value={domain} className="space-y-4">
            {domainArtifacts.map((artifact) => (
              <div key={artifact.id} className="overflow-hidden rounded-lg border border-border">
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

            <EvidenceTable items={items} />

            {domain === "budget" && (
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Budget lines ({budgetLines?.length ?? 0})
                </h3>
                <div className="space-y-1">
                  {(budgetLines ?? []).map((b) => (
                    <div key={b.id} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground/90">
                      {b.category} — {b.priority_tier} — probable ₹{b.probable_low ?? "?"}–₹{b.probable_high ?? "?"}
                      {b.confirmed && ` — confirmed ₹${b.confirmed}`}
                    </div>
                  ))}
                  {(budgetLines?.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground">None yet.</p>
                  )}
                </div>
              </div>
            )}

            {domain === "constraint" && (
              <div>
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Constraints ({constraints?.length ?? 0})
                </h3>
                <div className="space-y-1">
                  {(constraints ?? []).map((c) => (
                    <div key={c.id} className="rounded-lg border border-border px-3 py-2 text-xs">
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
              </div>
            )}
          </TabsContent>
        );
      })}

      <TabsContent value="other" className="space-y-6">
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            Assumptions ({assumptions?.length ?? 0})
          </h3>
          <div className="space-y-1">
            {(assumptions ?? []).map((a) => (
              <div key={a.id} className="rounded-lg border border-primary/20 px-3 py-2 text-xs">
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
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            Conflicts ({(conflicts ?? []).filter((c) => c.status === "open").length} open)
          </h3>
          <div className="space-y-1">
            {(conflicts ?? []).map((c) => (
              <div
                key={c.id}
                className={`rounded-lg px-3 py-2 text-xs ${
                  c.status === "open"
                    ? "border border-destructive/30 bg-destructive/10 text-destructive"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {c.reason} — {c.status}
              </div>
            ))}
            {(conflicts?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">None.</p>}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
