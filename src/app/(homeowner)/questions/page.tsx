import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { QuestionRow } from "@/components/decisions/QuestionRow";
import { HitlRequestCard, type HitlOption } from "@/components/decisions/HitlRequestCard";
import { RenovationDnaSnapshot } from "@/components/decisions/RenovationDnaSnapshot";
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

  const [{ data: questions }, { data: hitlRequests }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, question_text, why_it_matters, domain, severity")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("severity", { ascending: false }),
    supabase
      .from("yoxa_hitl_requests")
      .select("id, title, description, options")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const hasAnything = (questions?.length ?? 0) > 0 || (hitlRequests?.length ?? 0) > 0;

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

      {(hitlRequests ?? []).length > 0 && <RenovationDnaSnapshot projectId={projectId} />}
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

      {(questions ?? []).map((q) => (
        <QuestionRow key={q.id} question={q} projectId={projectId} />
      ))}
    </div>
  );
}
