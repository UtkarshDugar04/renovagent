import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgencyShell } from "./agency-shell";

export default async function AgencyLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "agency" && profile.role !== "admin")) {
    redirect("/conversation");
  }

  return (
    <AgencyShell userName={profile.full_name ?? user.email ?? "Agency"}>{children}</AgencyShell>
  );
}
