import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { logout } from "@/app/auth/login/actions";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";

const NAV = [
  { href: "/conversation", label: "Conversation" },
  { href: "/understanding", label: "Understanding" },
  { href: "/questions", label: "Questions & Decisions" },
  { href: "/design", label: "Design" },
  { href: "/activity", label: "Activity" },
] as const;

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

  const projectName = (membership.projects as unknown as { name: string } | null)?.name;

  return (
    <div className="flex min-h-screen flex-col">
      <RealtimeRefresher projectId={membership.project_id} />
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">Renovagent</p>
            <p className="text-xs text-stone-400">{projectName}</p>
          </div>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button className="text-xs text-stone-400 hover:text-stone-700">Log out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
