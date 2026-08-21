"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  // Generate the id client-side rather than chaining .select() on the
  // insert: the projects SELECT policy requires an existing project_members
  // row, which can't exist yet at the instant of insert — chaining .select()
  // there causes the RETURNING clause to hit RLS before membership exists.
  // Knowing the id upfront avoids ever needing to read the row back before
  // membership is established.
  const projectId = crypto.randomUUID();

  const { error: projectError } = await supabase.from("projects").insert({
    id: projectId,
    name,
    scope_summary: scopeSummary,
    budget_comfortable_low: budgetLow,
    budget_comfortable_high: budgetHigh,
    created_by: user.id,
  });

  if (projectError) {
    return { error: projectError.message };
  }

  const { error: memberError } = await supabase.from("project_members").insert({
    project_id: projectId,
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
    .insert(domains.map((domain) => ({ project_id: projectId, domain, state: "not_started" })));

  // Without this, the redirect below can land on a client Router Cache
  // entry for /conversation captured before this project existed — the
  // homeowner layout's membership check ran when there was no membership
  // yet, and that cached "show onboarding" render gets served again
  // instead of a fresh one. Confirmed live: the project and membership
  // rows were created correctly every time, but the UI kept re-showing an
  // empty onboarding form regardless. Revalidating the whole tree (route
  // groups have no URL segment of their own to target more narrowly) forces
  // a fresh server render on this navigation.
  revalidatePath("/", "layout");
  redirect("/conversation");
}
