"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the project a name to continue." };

  const scopeSummary = String(formData.get("scope_summary") ?? "").trim() || null;
  const budgetLow = formData.get("budget_low") ? Number(formData.get("budget_low")) : null;
  const budgetHigh = formData.get("budget_high") ? Number(formData.get("budget_high")) : null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name,
      scope_summary: scopeSummary,
      budget_comfortable_low: budgetLow,
      budget_comfortable_high: budgetHigh,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? "Couldn't create the project. Try again." };
  }

  const { error: memberError } = await supabase.from("project_members").insert({
    project_id: project.id,
    user_id: user.id,
    role: "homeowner",
  });

  if (memberError) {
    return { error: memberError.message };
  }

  // Seed readiness rows for all five domains at not_started.
  const domains = ["family", "spatial", "preference", "budget", "constraint"] as const;
  await supabase
    .from("readiness")
    .insert(domains.map((domain) => ({ project_id: project.id, domain, state: "not_started" })));

  redirect("/conversation");
}
