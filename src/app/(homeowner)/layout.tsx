import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { HomeownerShell } from "./homeowner-shell";

export default async function HomeownerLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Defense in depth: root page.tsx already routes agency/admin to
  // /projects on login, but a bookmark, a shared link, or the back button
  // can land a staff account here directly — without this check they'd
  // see the "create your first project" onboarding screen meant for a
  // brand new homeowner, since staff normally have no project_members row
  // of their own (see 20260818020000_agency_wide_access.sql).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "agency" || profile?.role === "admin") {
    redirect("/projects");
  }

  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id, projects(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <OnboardingForm />;
  }

  const projectName = (membership.projects as unknown as { name: string } | null)?.name ?? "Project";

  return (
    <>
      <RealtimeRefresher projectId={membership.project_id} />
      <HomeownerShell projectName={projectName} userEmail={user.email ?? ""}>
        {children}
      </HomeownerShell>
    </>
  );
}
