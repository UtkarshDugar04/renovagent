"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export interface HitlOption {
  option_id: string;
  title: string;
  description?: string;
}

interface HitlRequest {
  id: string;
  title: string;
  description: string | null;
  options: HitlOption[];
}

export function HitlRequestCard({ projectId, request }: { projectId: string; request: HitlRequest }) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [overrideText, setOverrideText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  async function submit(body: { selectedOptionId?: string; overrideMessage?: string }) {
    setError(null);
    setSubmitting(body.selectedOptionId ?? "override");
    try {
      const res = await fetch(`/api/projects/${projectId}/hitl/${request.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setAnswered(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(null);
    }
  }

  if (answered) {
    return (
      <Card className="border-0">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Decision submitted for &quot;{request.title}&quot;.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 border-l-2 border-l-primary">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{request.title}</CardTitle>
        </div>
        {request.description && (
          <p className="text-sm text-muted-foreground">{request.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {request.options.map((o) => (
            <Button
              key={o.option_id}
              variant="outline"
              disabled={submitting !== null}
              onClick={() => submit({ selectedOptionId: o.option_id })}
              title={o.description}
            >
              {submitting === o.option_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {o.title}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={overrideText}
            onChange={(e) => setOverrideText(e.target.value)}
            placeholder="Or write a custom response…"
            className="min-h-9 flex-1"
          />
          <Button
            disabled={!overrideText.trim() || submitting !== null}
            onClick={() => submit({ overrideMessage: overrideText.trim() })}
          >
            {submitting === "override" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
