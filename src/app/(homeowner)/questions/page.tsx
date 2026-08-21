import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MeaningVerificationCard } from "@/components/decisions/MeaningVerificationCard";
import { QuestionRow } from "@/components/decisions/QuestionRow";
import { ApprovalRequestCard } from "@/components/decisions/ApprovalRequestCard";
import { EscalationCard } from "@/components/decisions/EscalationCard";
import { HitlRequestCard, type HitlOption } from "@/components/decisions/HitlRequestCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function QuestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/");

  const projectId = membership.project_id;

  const [{ data: questions }, { data: approvals }, { data: escalations }, { data: readiness }, { data: hitlRequests }] =
    await Promise.all([
      supabase
        .from("questions")
        .select("id, question_text, why_it_matters, domain, severity")
        .eq("project_id", projectId)
        .eq("status", "open")
        .order("severity", { ascending: false }),
      supabase
        .from("approval_requests")
        .select("id, question, status, design_option_id, decision_id")
        .eq("project_id", projectId)
        .eq("status", "pending"),
      supabase
        .from("escalations")
        .select("id, trigger, question, required_authority, severity")
        .eq("project_id", projectId)
        .eq("status", "open"),
      supabase.from("readiness").select("domain, state").eq("project_id", projectId),
      supabase
        .from("yoxa_hitl_requests")
        .select("id, title, description, options")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  // Meaning Verification gate: every domain has just reached
  // sufficient_for_validation or validated for the first time, and no
  // project-level "meaning confirmed" decision exists yet. This is the
  // frontend's compensation for the backend's missing Layer 5 step —
  // see the architecture doc, Part 20.
  const allDomainsReady = (readiness ?? []).length === 5 &&
    (readiness ?? []).every((r) => r.state === "sufficient_for_validation" || r.state === "validated");

  const { data: meaningConfirmed } = await supabase
    .from("decisions")
    .select("id")
    .eq("project_id", projectId)
    .eq("decision_text", "meaning_verification_confirmed")
    .maybeSingle();

  const showMeaningVerification = allDomainsReady && !meaningConfirmed;

  const hasAnything =
    showMeaningVerification ||
    (questions?.length ?? 0) > 0 ||
    (approvals?.length ?? 0) > 0 ||
    (escalations?.length ?? 0) > 0 ||
    (hitlRequests?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Questions & Decisions</h1>
        <p className="text-sm text-muted-foreground">
          Only shows up here when something actually needs you.
        </p>
      </div>

      {!hasAnything && (
        <EmptyState icon={CheckCircle2} iconClassName="text-accent" description="Nothing waiting on you right now." />
      )}

      {(hitlRequests ?? []).map((r) => (
        <HitlRequestCard
          key={r.id}
          projectId={projectId}
          request={{
            id: r.id,
            title: r.title,
            description: r.description,
            options: Array.isArray(r.options) ? (r.options as unknown as HitlOption[]) : [],
          }}
        />
      ))}

      {showMeaningVerification && <MeaningVerificationCard projectId={projectId} />}

      {(escalations ?? []).map((e) => (
        <EscalationCard key={e.id} escalation={e} />
      ))}

      {(approvals ?? []).map((a) => (
        <ApprovalRequestCard key={a.id} approval={a} />
      ))}

      {(questions ?? []).map((q) => (
        <QuestionRow key={q.id} question={q} projectId={projectId} />
      ))}
    </div>
  );
}
