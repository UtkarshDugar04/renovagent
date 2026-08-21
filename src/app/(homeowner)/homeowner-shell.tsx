"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessagesSquare,
  BrainCircuit,
  ListTodo,
  LayoutGrid,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { logout } from "@/app/auth/login/actions";
import { usePendingHitlCount } from "@/lib/hooks/use-pending-hitl-count";

const NAV = [
  { href: "/conversation", label: "Talk to Renovagent", icon: MessagesSquare },
  { href: "/understanding", label: "Understanding", icon: BrainCircuit },
  { href: "/questions", label: "Questions & Decisions", icon: ListTodo },
  { href: "/design", label: "Design", icon: LayoutGrid },
] as const;

export function HomeownerShell({
  children,
  projectId,
  projectName,
  userEmail,
}: {
  children: React.ReactNode;
  projectId: string;
  projectName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const pendingHitlCount = usePendingHitlCount(projectId, "/questions");

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-4">
          <div className="px-1">
            <Logo size="sm" />
            <p className="mt-1 truncate pl-1 text-xs text-muted-foreground">{projectName}</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => {
                  const active = pathname?.startsWith(item.href) ?? false;
                  const showBadge = item.href === "/questions" && pendingHitlCount > 0;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                        <item.icon />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <Badge variant="secondary" className="bg-accent/15 text-accent">
                            {pendingHitlCount}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 pb-4">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/20 text-xs text-primary">
                {userEmail.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {userEmail}
            </span>
            <ThemeToggle />
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
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
