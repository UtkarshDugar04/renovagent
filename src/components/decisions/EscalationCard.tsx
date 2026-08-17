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
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="mb-1 text-sm font-semibold text-red-900">Professional verification needed</p>
      <p className="mb-1 text-sm text-red-800">{escalation.question ?? escalation.trigger}</p>
      <p className="text-xs text-red-600">
        Renovagent can&apos;t confirm this from the available information — it needs{" "}
        {AUTHORITY_COPY[escalation.required_authority] ?? "professional"} input before this can
        move forward. Your agency has been notified.
      </p>
    </div>
  );
}
