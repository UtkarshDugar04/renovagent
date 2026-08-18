"use client";

import { useState, useTransition } from "react";
import { FileText, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createHandoffBrief, approveAndSendHandoff } from "./actions";

interface HandoffRecord {
  id: string;
  brief: string;
  status: string;
  email_sent_to: string | null;
  created_at: string;
}

export function HandoffPanel({
  projectId,
  records,
}: {
  projectId: string;
  records: HandoffRecord[];
}) {
  const [isPending, startTransition] = useTransition();
  const [sendTo, setSendTo] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <Button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await createHandoffBrief(projectId);
          })
        }
        className="glow-primary"
      >
        <Sparkles className="h-4 w-4" />
        Generate handoff brief
      </Button>

      {records.length === 0 && (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No handoff brief generated yet.</p>
        </div>
      )}

      {records.map((r) => (
        <Card key={r.id} className="glass border-0">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge
                className={`text-xs font-normal ${
                  r.status === "sent" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"
                }`}
              >
                {r.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-xs text-foreground/80">
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
