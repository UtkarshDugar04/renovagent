"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

const noopSubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is undefined until after mount (next-themes reads the
  // real value client-side to avoid a server/client mismatch) — render a
  // stable placeholder until then rather than guessing. useSyncExternalStore
  // (rather than a setState-in-effect "mounted" flag) is the pattern React
  // itself recommends for this exact server/client divergence.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (!mounted) return <div className="h-3.5 w-3.5" />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
