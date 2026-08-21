// A single semantic tone system so the same kind of status always reads the
// same color everywhere, instead of every page hand-deriving its own
// status -> className map (design/page.tsx's STATE_VARIANT, overview's
// STATE_STYLE, dna's STATUS_STYLE, design-review's STATUS_STYLE,
// QuestionRow's SEVERITY_BORDER all did this independently before).

export type Tone = "neutral" | "progress" | "positive" | "warning" | "danger";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  progress: "bg-primary/10 text-primary",
  positive: "bg-accent/10 text-accent",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

export const TONE_BORDER_CLASSES: Record<Tone, string> = {
  neutral: "border-border",
  progress: "border-primary/30",
  positive: "border-accent/30",
  warning: "border-warning/40",
  danger: "border-destructive/40",
};

export function readinessTone(state: string): Tone {
  switch (state) {
    case "not_started":
    case "discovery_in_progress":
      return "neutral";
    case "partially_understood":
      return "warning";
    case "sufficient_for_validation":
      return "progress";
    case "validated":
      return "positive";
    default:
      return "neutral";
  }
}

export function evidenceStatusTone(status: string): Tone {
  switch (status) {
    case "explicit":
    case "verified":
      return "positive";
    case "inferred":
    case "assumed":
      return "progress";
    case "conflicted":
    case "stale":
      return "warning";
    case "unresolved":
    case "superseded":
      return "neutral";
    default:
      return "neutral";
  }
}

export function designOptionTone(status: string): Tone {
  switch (status) {
    case "proposed":
      return "progress";
    case "validated":
      return "positive";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function validationResultTone(result: string): Tone {
  switch (result) {
    case "pass":
      return "positive";
    case "pass_with_conditions":
      return "warning";
    case "fail":
      return "danger";
    case "missing_information":
    case "professional_verification_required":
    case "human_decision_required":
      return "warning";
    default:
      return "neutral";
  }
}

// e0 (lowest) .. e5 (highest)
export function severityTone(severity: string): Tone {
  switch (severity) {
    case "e0":
    case "e1":
      return "neutral";
    case "e2":
      return "progress";
    case "e3":
      return "warning";
    case "e4":
    case "e5":
      return "danger";
    default:
      return "neutral";
  }
}

export function constraintStatusTone(status: string): Tone {
  switch (status) {
    case "confirmed":
    case "cleared":
      return "positive";
    case "provisional":
      return "progress";
    case "requires_verification":
      return "warning";
    case "unresolved":
      return "neutral";
    default:
      return "neutral";
  }
}
