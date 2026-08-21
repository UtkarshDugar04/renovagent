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

// Yoxa composes `description` as free-text prose, but the agent is
// instructed to organize it by domain/candidate with short ALL-CAPS
// section headers on their own line (confirmed live: "FAMILY / HOUSEHOLD",
// "SPACE", "PREFERENCES", ...). There's no schema for this — it's prose —
// so this recovers that structure heuristically instead of rendering one
// dense paragraph. Falls back to plain text when nothing header-shaped is
// found, so content from a differently-shaped checkpoint (or no structure
// at all) still renders correctly.
const HEADER_LINE = /^[A-Z][A-Z0-9 /&'-]{1,48}$/;

function parseSections(description: string): { heading: string | null; body: string }[] {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: { heading: string | null; body: string[] }[] = [];
  let current: { heading: string | null; body: string[] } = { heading: null, body: [] };

  for (const line of lines) {
    const looksLikeHeader = HEADER_LINE.test(line) && !line.endsWith(".") && line.split(" ").length <= 6;
    if (looksLikeHeader) {
      if (current.heading || current.body.length) sections.push(current);
      current = { heading: line, body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.heading || current.body.length) sections.push(current);
  return sections.map((s) => ({ heading: s.heading, body: s.body.join(" ") }));
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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

  const sections = request.description ? parseSections(request.description) : [];
  const structured = sections.filter((s) => s.heading).length >= 2;

  return (
    <Card className="border-0 border-l-2 border-l-primary">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{request.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {structured ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            {sections.map((s, i) =>
              s.heading ? (
                <div key={i}>
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
                    {titleCase(s.heading)}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/90">{s.body}</p>
                </div>
              ) : s.body ? (
                <p key={i} className="text-sm text-muted-foreground italic">{s.body}</p>
              ) : null
            )}
          </div>
        ) : (
          request.description && (
            <p className="text-sm text-muted-foreground">{request.description}</p>
          )
        )}

        <div className="space-y-2">
          {request.options.map((o) => (
            <button
              key={o.option_id}
              type="button"
              disabled={submitting !== null}
              onClick={() => submit({ selectedOptionId: o.option_id })}
              className="flex w-full items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-60"
            >
              <span>
                <span className="font-medium text-foreground">{o.title}</span>
                {o.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{o.description}</span>
                )}
              </span>
              {submitting === o.option_id && (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              )}
            </button>
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
