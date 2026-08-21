"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/shared/Logo";
import { createProject } from "./actions";

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="sm" className="mb-3" />
          <h1 className="text-xl font-semibold tracking-tight">
            Let&apos;s start with the basics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing here is final — Renovagent builds on this as we talk.
          </p>
        </div>

        <Card className="p-6">
        <form
          className="space-y-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createProject(formData);
              if (result?.error) setError(result.error);
            });
          }}
        >
          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">What should we call this project?</Label>
            <Input id="name" name="name" required placeholder="e.g. Our 3BHK renovation" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scope_summary">In a sentence, why are you renovating?</Label>
            <Textarea
              id="scope_summary"
              name="scope_summary"
              rows={2}
              placeholder="e.g. the kitchen feels cramped and we want to open it up"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget_low">Comfortable budget from</Label>
              <Input id="budget_low" name="budget_low" type="number" placeholder="₹" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget_high">to</Label>
              <Input id="budget_high" name="budget_high" type="number" placeholder="₹" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A rough starting range is fine — this becomes an envelope, not a fixed number.
          </p>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Start"}
          </Button>
        </form>
        </Card>
      </div>
    </div>
  );
}
