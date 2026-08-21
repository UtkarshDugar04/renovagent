"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BrainCircuit, LayoutGrid, ShieldAlert, Handshake, Phone } from "lucide-react";

const NAV = [
  { segment: "overview", label: "Overview", icon: LayoutDashboard },
  { segment: "call", label: "Call", icon: Phone },
  { segment: "dna", label: "Renovation DNA", icon: BrainCircuit },
  { segment: "design-review", label: "Design Review", icon: LayoutGrid },
  { segment: "escalations", label: "Escalations", icon: ShieldAlert },
  { segment: "handoff", label: "Handoff", icon: Handshake },
] as const;

export function ProjectSubNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
      {NAV.map((item) => {
        const href = `/projects/${projectId}/${item.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={item.segment}
            href={href}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
