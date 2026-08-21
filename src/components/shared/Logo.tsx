import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ size = "default", className }: { size?: "default" | "sm" | "lg"; className?: string }) {
  const boxSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex shrink-0 items-center justify-center rounded-lg bg-primary", boxSize)}>
        <Sparkles className={cn("text-primary-foreground", iconSize)} />
      </div>
      <span className={cn("font-semibold text-primary", textSize)}>Renovagent</span>
    </div>
  );
}
