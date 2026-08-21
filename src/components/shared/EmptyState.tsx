import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconClassName,
  className,
}: {
  icon: LucideIcon;
  title?: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-0", className)}>
      <CardContent className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <Icon className={cn("h-5 w-5 text-muted-foreground", iconClassName)} />
        {title && <p className="text-sm font-medium text-foreground">{title}</p>}
        <p className="text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
