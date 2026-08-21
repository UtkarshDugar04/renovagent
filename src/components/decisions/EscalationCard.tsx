import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Escalation {
  id: string;
  trigger: string;
  question: string | null;
  required_authority: string;
}

const AUTHORITY_COPY: Record<string, string> = {
  d3_professional: "a qualified professional",
  d4_external: "an external/regulatory authority",
};

// Never "agent failed" — always what's known, what's unknown, why it
// matters, and who needs to resolve it.
export function EscalationCard({ escalation }: { escalation: Escalation }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <CardTitle className="text-base">Professional verification needed</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{escalation.question ?? escalation.trigger}</p>
        <p className="text-xs text-destructive/80">
          Renovagent can&apos;t confirm this from the available information — it needs{" "}
          {AUTHORITY_COPY[escalation.required_authority] ?? "professional"} input before this can
          move forward. Your agency has been notified.
        </p>
      </CardContent>
    </Card>
  );
}
