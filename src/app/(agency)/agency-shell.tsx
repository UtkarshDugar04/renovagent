"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LogOut,
  FolderOpen,
  LayoutDashboard,
  Phone,
  BrainCircuit,
  LayoutGrid,
  ShieldAlert,
  Handshake,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { logout } from "@/app/auth/login/actions";

const PROJECT_NAV = [
  { segment: "overview", label: "Overview", icon: LayoutDashboard },
  { segment: "call", label: "Call", icon: Phone },
  { segment: "dna", label: "Renovation DNA", icon: BrainCircuit },
  { segment: "design-review", label: "Design Review", icon: LayoutGrid },
  { segment: "escalations", label: "Escalations", icon: ShieldAlert },
  { segment: "handoff", label: "Handoff", icon: Handshake },
] as const;

export function AgencyShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const projectId = pathname?.match(/^\/projects\/([^/]+)/)?.[1];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-4">
          <Link href="/projects" className="flex items-center gap-2 px-1">
            <Logo size="sm" />
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              <Building2 className="h-2.5 w-2.5" />
              Agency
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={pathname === "/projects"} render={<Link href="/projects" />}>
                    <FolderOpen />
                    <span>All projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {projectId && (
            <SidebarGroup>
              <SidebarGroupLabel>This project</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {PROJECT_NAV.map((item) => {
                    const href = `/projects/${projectId}/${item.segment}`;
                    return (
                      <SidebarMenuItem key={item.segment}>
                        <SidebarMenuButton isActive={pathname === href} render={<Link href={href} />}>
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="px-3 pb-4">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-muted text-xs text-foreground">
                {userName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{userName}</span>
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
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
