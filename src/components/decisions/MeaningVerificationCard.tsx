"use client";

import { useTransition } from "react";
import { confirmMeaning } from "@/app/(homeowner)/questions/actions";

// The frontend's compensation for the backend's missing "Meaning
// Verification" step (Layer 5 of the canonical system matrix — distinct
// from the technical readiness check). Before design exploration ever
// unlocks, the homeowner explicitly confirms the understanding is right.
export function MeaningVerificationCard({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-stone-300 bg-stone-50 p-4">
      <p className="mb-1 text-sm font-semibold text-stone-900">Does this look right?</p>
      <p className="mb-3 text-sm text-stone-600">
        Renovagent now has enough to start exploring design directions — but before it does,
        take a look at the{" "}
        <a href="/understanding" className="underline">
          Understanding page
        </a>{" "}
        and confirm it actually reflects your household and home. Anything wrong there can be
        corrected before it shapes every design option that follows.
      </p>
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await confirmMeaning(projectId); })}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          Yes, this is right
        </button>
        <a
          href="/conversation"
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-white"
        >
          Something&apos;s off — let me correct it
        </a>
      </div>
    </div>
  );
}
