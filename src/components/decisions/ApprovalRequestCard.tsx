"use client";

import { useTransition } from "react";
import { Gavel, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveApproval } from "@/app/(homeowner)/questions/actions";

interface Approval {
  id: string;
  question: string;
  status: string;
}

export function ApprovalRequestCard({ approval }: { approval: Approval }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="glass glow-accent border-accent/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Your decision is needed</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{approval.question}</p>
        <div className="flex gap-2">
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await resolveApproval(approval.id, "approved");
              })
            }
          >
            <Check className="h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await resolveApproval(approval.id, "rejected");
              })
            }
          >
            <X className="h-4 w-4" />
            Not this one
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
