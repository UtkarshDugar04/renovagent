"use client";

import { useState, useTransition } from "react";
import { resolveEscalation } from "@/app/(agency)/projects/[projectId]/escalations/actions";

interface Escalation {
  id: string;
  trigger: string;
  question: string | null;
  required_authority: string;
  severity: string;
}

export function EscalationResolutionForm({
  escalation,
  projectId,
}: {
  escalation: Escalation;
  projectId: string;
}) {
  const [resolution, setResolution] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-900">{escalation.question ?? escalation.trigger}</p>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
          {escalation.severity.toUpperCase()}
        </span>
      </div>
      <p className="mb-2 text-xs text-amber-700">
        Requires {escalation.required_authority.replace(/^d[0-4]_/, "")} sign-off.
      </p>
      <div className="flex gap-2">
        <input
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Verification finding, e.g. 'wall confirmed non-load-bearing per site inspection'"
          className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-500"
        />
        <button
          disabled={!resolution.trim() || isPending}
          onClick={() =>
            startTransition(async () => {
              await resolveEscalation(escalation.id, projectId, resolution.trim());
              setResolution("");
            })
          }
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Record & resolve
        </button>
      </div>
    </div>
  );
}
