"use client";

import { useState, useTransition } from "react";
import { FileText, Image as ImageIcon, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { createHandoffBrief, approveAndSendHandoff } from "./actions";

interface HandoffRecord {
  id: string;
  brief: string;
  status: string;
  email_sent_to: string | null;
  created_at: string;
}

interface DesignReference {
  optionLabel: string;
  images: { id: string; url: string; angle: string | null }[];
  products: { id: string; vendor_name: string; product_name: string; product_url: string | null; price: number | null; currency: string }[];
}

export function HandoffPanel({
  projectId,
  records,
  designReferences,
  floorPlanUrl,
}: {
  projectId: string;
  records: HandoffRecord[];
  designReferences: DesignReference[];
  floorPlanUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [sendTo, setSendTo] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await createHandoffBrief(projectId);
            })
          }
        >
          <Sparkles className="h-4 w-4" />
          Generate handoff brief
        </Button>
        <p className="text-xs text-muted-foreground">
          Renovagent generates one automatically once a design direction is ready — use this only
          if you need a draft sooner.
        </p>
      </div>

      {floorPlanUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" />
              Floor plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={floorPlanUrl}
              alt="Floor plan"
              className="max-h-96 w-full rounded-md border border-border object-contain"
            />
          </CardContent>
        </Card>
      )}

      {designReferences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" />
              Design references for execution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              The validated design direction — carry these images forward alongside the brief;
              they are the visual reference later execution stages build from.
            </p>
            {designReferences.map((ref) => (
              <div key={ref.optionLabel} className="space-y-2">
                <p className="text-sm font-medium">{ref.optionLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {ref.images.map((img) => (
                    <div key={img.id} className="w-40 shrink-0 space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.angle ?? ref.optionLabel}
                        className="h-28 w-40 rounded-md border border-border object-cover"
                      />
                      {img.angle && <p className="text-xs text-muted-foreground">{img.angle}</p>}
                    </div>
                  ))}
                </div>
                {ref.products.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {ref.products.map((p) => (
                      <p key={p.id} className="text-xs text-muted-foreground">
                        <span className="text-foreground/90">{p.vendor_name}</span>
                        {" · "}
                        {p.product_url ? (
                          <a href={p.product_url} target="_blank" rel="noreferrer" className="text-accent underline">
                            {p.product_name}
                          </a>
                        ) : (
                          p.product_name
                        )}
                        {p.price != null && ` — ${p.currency} ${p.price.toLocaleString("en-IN")}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {records.length === 0 && (
        <EmptyState icon={FileText} description="No handoff brief generated yet." />
      )}

      {records.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <StatusBadge tone={r.status === "sent" ? "positive" : "progress"} className="text-xs">
                {r.status}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-neutral-900 p-3 font-mono text-xs text-neutral-100">
              {r.brief}
            </pre>

            {r.status === "pending_approval" && (
              <div className="flex gap-2">
                <Input
                  value={sendTo[r.id] ?? ""}
                  onChange={(e) => setSendTo((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Send to (email)"
                  className="h-8 flex-1 text-sm"
                />
                <Button
                  size="sm"
                  disabled={!sendTo[r.id]?.trim() || isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await approveAndSendHandoff(r.id, projectId, sendTo[r.id].trim());
                    })
                  }
                >
                  <Send className="h-3.5 w-3.5" />
                  Approve & mark sent
                </Button>
              </div>
            )}
            {r.status === "sent" && (
              <p className="text-xs text-muted-foreground">Sent to {r.email_sent_to}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
