"use client";

import { useTransition } from "react";
import { resolveApproval } from "@/app/(homeowner)/questions/actions";

interface Approval {
  id: string;
  question: string;
  status: string;
}

export function ApprovalRequestCard({ approval }: { approval: Approval }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="mb-1 text-sm font-semibold text-blue-900">Your decision is needed</p>
      <p className="mb-3 text-sm text-blue-800">{approval.question}</p>
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await resolveApproval(approval.id, "approved");
            })
          }
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await resolveApproval(approval.id, "rejected");
            })
          }
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
        >
          Not this one
        </button>
      </div>
    </div>
  );
}
