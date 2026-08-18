// Product-level domain types — the frontend's actual vocabulary.
// These mirror the Postgres schema (supabase/migrations) but are the stable
// contract components and API routes are written against. Never import raw
// generated DB types directly into a component; go through these.

export type Domain = "family" | "spatial" | "preference" | "budget" | "constraint";

export type EvidenceType =
  | "aspiration" | "requirement" | "preference" | "routine" | "pain_point"
  | "observation" | "constraint" | "priority" | "decision" | "trade_off"
  | "assumption" | "inference" | "question" | "conflict" | "verification" | "rejection";

export type EvidenceStatus =
  | "explicit" | "verified" | "inferred" | "assumed"
  | "unresolved" | "conflicted" | "stale" | "superseded";

export type Confidence = "unknown" | "low" | "medium" | "high";

export type Authority = "d0_agent" | "d1_recommendation" | "d2_homeowner" | "d3_professional" | "d4_external";

export type Severity = "e0" | "e1" | "e2" | "e3" | "e4" | "e5";

export type ReadinessState =
  | "not_started" | "discovery_in_progress" | "partially_understood"
  | "sufficient_for_validation" | "validated";

export interface Project {
  id: string;
  name: string;
  propertyAddress: string | null;
  scopeSummary: string | null;
  budget: {
    comfortable: [number, number] | null;
    stretch: [number, number] | null;
    ceiling: number | null;
  };
  phase: string;
  createdAt: string;
}

export interface Evidence {
  id: string;
  projectId: string;
  domain: Domain;
  evidenceType: EvidenceType;
  statement: string;
  status: EvidenceStatus;
  confidence: Confidence;
  authority: Authority;
  source: string | null;
  contradictsEvidenceId: string | null;
  supersededById: string | null;
  createdAt: string;
}

export interface Question {
  id: string;
  projectId: string;
  domain: Domain | null;
  questionText: string;
  whyItMatters: string | null;
  severity: Severity;
  blocksReadiness: boolean;
  status: "open" | "waiting" | "resolved";
  createdAt: string;
}

export interface Decision {
  id: string;
  projectId: string;
  decisionText: string;
  decisionMakerRole: "homeowner" | "agency" | "admin" | null;
  alternativesConsidered: string[];
  rationale: string | null;
  affectedDomains: Domain[];
  status: string;
  createdAt: string;
}

export interface Conflict {
  id: string;
  projectId: string;
  evidenceAId: string;
  evidenceBId: string;
  reason: string;
  affectedDomains: Domain[];
  blocksDecisionId: string | null;
  status: string;
  createdAt: string;
}

export interface DesignOptionSubFeedback {
  subElement: string | null;
  sentiment: "like" | "dislike" | "neutral";
  comment: string | null;
}

export interface DesignOption {
  id: string;
  projectId: string;
  designRoundId: string;
  label: string;
  rationale: string;
  satisfiesEvidenceIds: string[];
  tradeOffs: { gained: string; sacrificed: string }[];
  costBand: { low: number; high: number; confidence: Confidence } | null;
  sourcingStatus: "not_evaluated" | "grounded" | "indicative" | "ungrounded";
  whatItWouldFeelLike: string | null;
  status: "proposed" | "validated" | "rejected";
  visibleToHomeowner: boolean;
  createdAt: string;
}

export interface ValidationResult {
  id: string;
  projectId: string;
  mode: "readiness" | "design";
  targetType: "readiness_proposal" | "design_option";
  targetId: string | null;
  result: "pass" | "fail" | "pass_with_conditions" | "missing_information" | "professional_verification_required" | "human_decision_required";
  failedCriteria: { criterion: string; evidence: string }[];
  unresolvedRisks: string[];
  humanDecisionRequired: boolean;
  createdAt: string;
}

export interface Escalation {
  id: string;
  projectId: string;
  trigger: string;
  question: string | null;
  domain: Domain | null;
  severity: Severity;
  requiredAuthority: Authority;
  blocking: boolean;
  status: "open" | "waiting" | "resolved";
  resolution: string | null;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  projectId: string;
  designOptionId: string | null;
  decisionId: string | null;
  question: string;
  status: "pending" | "approved" | "rejected" | "modified";
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  projectId: string;
  senderRole: "homeowner" | "agency" | "admin";
  text: string;
  turnType: "new_message" | "design_feedback" | "decision_resolution" | "call_transcript";
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  eventType: string;
  activitySummary: string | null;
  createdAt: string;
}

export interface Readiness {
  domain: Domain;
  state: ReadinessState;
  reason: string | null;
}
