import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/login/actions";

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
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/projects" className="text-sm font-semibold text-stone-900">
            Renovagent — Agency
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">{profile.full_name}</span>
            <form action={logout}>
              <button className="text-xs text-stone-400 hover:text-stone-700">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
