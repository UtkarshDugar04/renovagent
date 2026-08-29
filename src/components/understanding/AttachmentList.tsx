"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface AttachmentItem {
  id: string;
  label: string;
  url: string | null;
  status: string;
  mimeType: string | null;
}

export function AttachmentList({ projectId, initialAttachments }: { projectId: string; initialAttachments: AttachmentItem[] }) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`attachments:${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "attachments", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          setAttachments((prev) => prev.map((a) => (a.id === row.id ? { ...a, status: row.status } : a)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  async function retry(id: string) {
    setRetrying((prev) => new Set(prev).add(id));
    await fetch(`/api/projects/${projectId}/attachments/${id}/process`, { method: "POST" });
    setRetrying((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {attachments.map((a) => {
        const isImage = a.mimeType?.startsWith("image/") ?? false;
        const statusOverlay = (a.status === "pending" || a.status === "processing") && (
          <span title="Analyzing…" className="absolute right-1 top-1">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          </span>
        );
        const retryControl = a.status === "failed" && (
          <button
            onClick={() => retry(a.id)}
            disabled={retrying.has(a.id)}
            className="flex items-center gap-1 text-destructive hover:text-destructive/80"
            title="Analysis failed — retry"
          >
            <TriangleAlert className="h-3 w-3" />
            {retrying.has(a.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
          </button>
        );

        if (isImage && a.url) {
          return (
            <div key={a.id} className="group relative">
              <a href={a.url} target="_blank" rel="noreferrer" className="block" title={a.label}>
                <img
                  src={a.url}
                  alt={a.label}
                  className="h-24 w-24 rounded-lg border border-border object-cover transition-opacity group-hover:opacity-80"
                />
                {statusOverlay}
              </a>
              {retryControl && (
                <div className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5">{retryControl}</div>
              )}
            </div>
          );
        }

        return (
          <div
            key={a.id}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
          >
            <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
              {a.label}
            </a>
            {statusOverlay}
            {retryControl}
          </div>
        );
      })}
    </div>
  );
}
