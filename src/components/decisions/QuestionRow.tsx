"use client";

import { useState, useTransition } from "react";
import { answerQuestion } from "@/app/(homeowner)/questions/actions";

interface Question {
  id: string;
  question_text: string;
  why_it_matters: string | null;
  domain: string | null;
  severity: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  e0: "border-stone-200 bg-white",
  e1: "border-stone-200 bg-white",
  e2: "border-amber-200 bg-amber-50",
  e3: "border-amber-300 bg-amber-50",
  e4: "border-red-200 bg-red-50",
  e5: "border-red-300 bg-red-50",
};

export function QuestionRow({ question, projectId }: { question: Question; projectId: string }) {
  const [answer, setAnswer] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`rounded-lg border px-3 py-2 ${SEVERITY_STYLE[question.severity] ?? "border-stone-200 bg-white"}`}>
      <button
        className="w-full text-left text-sm text-stone-800"
        onClick={() => setExpanded((v) => !v)}
      >
        {question.question_text}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {question.why_it_matters && (
            <p className="text-xs text-stone-500">{question.why_it_matters}</p>
          )}
          <div className="flex gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer…"
              className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-500"
            />
            <button
              disabled={!answer.trim() || isPending}
              onClick={() =>
                startTransition(async () => {
                  await answerQuestion(question.id, projectId, answer.trim());
                  setAnswer("");
                  setExpanded(false);
                })
              }
              className="rounded-md bg-stone-900 px-3 py-1 text-sm text-white disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
