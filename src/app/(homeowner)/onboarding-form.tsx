"use client";

import { useState, useTransition } from "react";
import { createProject } from "./actions";

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <form
        className="w-full max-w-md space-y-4"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createProject(formData);
            if (result?.error) setError(result.error);
          });
        }}
      >
        <h1 className="text-2xl font-semibold text-stone-900">
          Let&apos;s start with the basics
        </h1>
        <p className="text-sm text-stone-500">
          Nothing here is final — Renovagent will build on this as we talk.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div>
          <label htmlFor="name" className="mb-1 block text-sm text-stone-600">
            What should we call this project?
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Our 3BHK renovation"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
        </div>

        <div>
          <label htmlFor="scope_summary" className="mb-1 block text-sm text-stone-600">
            In a sentence, why are you renovating?
          </label>
          <textarea
            id="scope_summary"
            name="scope_summary"
            rows={2}
            placeholder="e.g. the kitchen feels cramped and we want to open it up"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="budget_low" className="mb-1 block text-sm text-stone-600">
              Comfortable budget from
            </label>
            <input
              id="budget_low"
              name="budget_low"
              type="number"
              placeholder="₹"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <div>
            <label htmlFor="budget_high" className="mb-1 block text-sm text-stone-600">
              to
            </label>
            <input
              id="budget_high"
              name="budget_high"
              type="number"
              placeholder="₹"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
        </div>
        <p className="text-xs text-stone-400">
          A rough starting range is fine — this becomes an envelope, not a fixed number.
        </p>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Start"}
        </button>
      </form>
    </div>
  );
}
