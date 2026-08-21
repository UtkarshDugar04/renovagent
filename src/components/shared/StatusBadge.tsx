import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/status-styles";

export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="secondary" className={cn("font-normal", TONE_CLASSES[tone], className)}>
      {children}
    </Badge>
  );
}
