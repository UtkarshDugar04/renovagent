"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface AttachmentItem {
  id: string;
  label: string;
  url: string | null;
  status: string;
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
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) => (
        <div
          key={a.id}
          className="glass flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground"
        >
          <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            {a.label}
          </a>
          {(a.status === "pending" || a.status === "processing") && (
            <span title="Analyzing…">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
            </span>
          )}
          {a.status === "failed" && (
            <button
              onClick={() => retry(a.id)}
              disabled={retrying.has(a.id)}
              className="flex items-center gap-1 text-destructive hover:text-destructive/80"
              title="Analysis failed — retry"
            >
              <TriangleAlert className="h-3 w-3" />
              {retrying.has(a.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
