"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { answerQuestion } from "@/app/(homeowner)/questions/actions";
import { severityTone, TONE_BORDER_CLASSES } from "@/lib/status-styles";

interface Question {
  id: string;
  question_text: string;
  why_it_matters: string | null;
  domain: string | null;
  severity: string;
}

export function QuestionRow({ question, projectId }: { question: Question; projectId: string }) {
  const [answer, setAnswer] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className={`border ${TONE_BORDER_CLASSES[severityTone(question.severity)]}`}>
      <CardContent className="p-3">
        <button
          className="flex w-full items-center justify-between gap-2 text-left text-sm"
          onClick={() => setExpanded((v) => !v)}
        >
          <span>{question.question_text}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {expanded && (
          <div className="mt-3 space-y-2">
            {question.why_it_matters && (
              <p className="text-xs text-muted-foreground">{question.why_it_matters}</p>
            )}
            <div className="flex gap-2">
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer…"
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                disabled={!answer.trim() || isPending}
                onClick={() =>
                  startTransition(async () => {
                    await answerQuestion(question.id, projectId, answer.trim());
                    setAnswer("");
                    setExpanded(false);
                  })
                }
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
