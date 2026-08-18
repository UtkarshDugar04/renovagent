"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="glass border-accent/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-medium">
              {escalation.question ?? escalation.trigger}
            </CardTitle>
          </div>
          <Badge className="bg-accent/10 text-xs font-normal text-accent">
            {escalation.severity.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Requires {escalation.required_authority.replace(/^d[0-4]_/, "")} sign-off.
        </p>
        <div className="flex gap-2">
          <Input
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Verification finding, e.g. 'wall confirmed non-load-bearing per site inspection'"
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            disabled={!resolution.trim() || isPending}
            onClick={() =>
              startTransition(async () => {
                await resolveEscalation(escalation.id, projectId, resolution.trim());
                setResolution("");
              })
            }
          >
            <Check className="h-3.5 w-3.5" />
            Record & resolve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
