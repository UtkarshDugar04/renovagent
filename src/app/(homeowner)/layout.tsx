import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { HomeownerShell } from "./homeowner-shell";

export default async function HomeownerLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

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
