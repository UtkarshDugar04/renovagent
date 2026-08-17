"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { confirmMeaning } from "@/app/(homeowner)/questions/actions";

// The frontend's compensation for the backend's missing "Meaning
// Verification" step (Layer 5 of the canonical system matrix — distinct
// from the technical readiness check). Before design exploration ever
// unlocks, the homeowner explicitly confirms the understanding is right.
export function MeaningVerificationCard({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="glass glow-primary border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Does this look right?</CardTitle>
        </div>
        <CardDescription>
          Renovagent now has enough to start exploring design directions — but before it does,
          take a look at{" "}
          <Link href="/understanding" className="text-primary underline underline-offset-2">
            what it understands
          </Link>{" "}
          and confirm it actually reflects your household and home.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          disabled={isPending}
          onClick={() => startTransition(async () => { await confirmMeaning(projectId); })}
          className="glow-primary"
        >
          <CheckCircle2 className="h-4 w-4" />
          Yes, this is right
        </Button>
        <Button variant="outline" render={<Link href="/conversation" />}>
          Something&apos;s off
        </Button>
      </CardContent>
    </Card>
  );
}
