"use client";

import Link from "next/link";
import { Sparkles, Building2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/app/auth/login/actions";

export function AgencyShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass glow-primary">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gradient">Renovagent</span>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                <Building2 className="h-2.5 w-2.5" />
                Agency
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/20 text-xs text-primary">
                {userName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{userName}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground"
                title="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
