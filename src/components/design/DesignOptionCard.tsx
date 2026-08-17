"use client";

import { useState, useTransition } from "react";
import { submitDesignFeedback } from "@/app/(homeowner)/design/actions";

interface TradeOff {
  gained: string;
  sacrificed: string;
}

interface DesignOption {
  id: string;
  label: string;
  rationale: string;
  trade_offs: unknown;
  cost_band: { low: number; high: number; confidence: string } | null;
  sourcing_status: string;
  what_it_would_feel_like: string | null;
  status: string;
}

const SUB_ELEMENTS = ["layout", "materials", "colour", "storage", "lighting", "cost"] as const;

export function DesignOptionCard({
  option,
  projectId,
}: {
  option: DesignOption;
  projectId: string;
}) {
  const tradeOffs = Array.isArray(option.trade_offs) ? (option.trade_offs as TradeOff[]) : [];
  const [comment, setComment] = useState("");
  const [subElement, setSubElement] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState<"like" | "dislike" | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(sentiment: "like" | "dislike") {
    startTransition(async () => {
      await submitDesignFeedback(option.id, projectId, sentiment, comment.trim(), subElement);
      setSubmitted(sentiment);
      setComment("");
    });
  }

  return (
    <div className={`rounded-xl border bg-white p-4 ${option.status === "rejected" ? "border-stone-200 opacity-50" : "border-stone-200"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">{option.label}</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {option.status === "validated" ? "Checked and viable" : option.status === "rejected" ? "You passed on this" : "Proposed"}
        </span>
      </div>
      <p className="mb-3 text-sm text-stone-600">{option.rationale}</p>

      {option.what_it_would_feel_like && (
        <p className="mb-3 text-sm italic text-stone-500">{option.what_it_would_feel_like}</p>
      )}

      {tradeOffs.length > 0 && (
        <div className="mb-3 space-y-1">
          {tradeOffs.map((t, i) => (
            <p key={i} className="text-xs text-stone-500">
              <span className="font-medium text-stone-700">Gains:</span> {t.gained} ·{" "}
              <span className="font-medium text-stone-700">Costs:</span> {t.sacrificed}
            </p>
          ))}
        </div>
      )}

      {option.cost_band && (
        <p className="mb-3 text-xs text-stone-400">
          Estimated ₹{option.cost_band.low.toLocaleString()}–₹{option.cost_band.high.toLocaleString()}
          {option.sourcing_status !== "grounded" && " (indicative, not yet vendor-confirmed)"}
        </p>
      )}

      <div className="border-t border-stone-100 pt-3">
        {submitted ? (
          <p className="text-xs text-stone-400">
            Feedback recorded {submitted === "like" ? "👍" : "👎"} — thanks, this shapes what comes next.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {SUB_ELEMENTS.map((el) => (
                <button
                  key={el}
                  onClick={() => setSubElement((prev) => (prev === el ? undefined : el))}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    subElement === el ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  }`}
                >
                  {el}
                </button>
              ))}
            </div>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={subElement ? `What about the ${subElement}?` : "Anything specific? (optional)"}
              className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-xs outline-none focus:border-stone-500"
            />
            <div className="flex gap-2">
              <button
                disabled={isPending}
                onClick={() => submit("like")}
                className="flex-1 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-40"
              >
                👍 Like this
              </button>
              <button
                disabled={isPending}
                onClick={() => submit("dislike")}
                className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
              >
                👎 Not this one
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
