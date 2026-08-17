"use client";

import { useState, useTransition } from "react";
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
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await createHandoffBrief(projectId);
          })
        }
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        Generate handoff brief
      </button>

      {records.length === 0 && (
        <p className="text-sm text-stone-400">No handoff brief generated yet.</p>
      )}

      {records.map((r) => (
        <div key={r.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                r.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {r.status}
            </span>
            <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleString()}</span>
          </div>
          <pre className="mb-3 whitespace-pre-wrap rounded bg-stone-50 p-3 text-xs text-stone-700">
            {r.brief}
          </pre>

          {r.status === "pending_approval" && (
            <div className="flex gap-2">
              <input
                value={sendTo[r.id] ?? ""}
                onChange={(e) => setSendTo((prev) => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="Send to (email)"
                className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
              />
              <button
                disabled={!sendTo[r.id]?.trim() || isPending}
                onClick={() =>
                  startTransition(async () => {
                    await approveAndSendHandoff(r.id, projectId, sendTo[r.id].trim());
                  })
                }
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                Approve & mark sent
              </button>
            </div>
          )}
          {r.status === "sent" && (
            <p className="text-xs text-stone-500">Sent to {r.email_sent_to}</p>
          )}
        </div>
      ))}
    </div>
  );
}
