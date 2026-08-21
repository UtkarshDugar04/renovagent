import { Sparkles, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Shared message-bubble shape for CallRoom and ConversationPanel — "self"
// is whichever side the current viewer is on (always the homeowner in
// ConversationPanel; whoever's logged in, in CallRoom, since that's shared
// between agency and homeowner). The other side is always Renovagent's own
// assistant.
export function ChatBubble({
  self,
  caption,
  children,
}: {
  self: boolean;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-end gap-2", self ? "justify-end" : "justify-start")}>
      {!self && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          self
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-card-foreground"
        )}
      >
        {caption && (
          <span className="mb-0.5 block text-[10px] font-medium tracking-wide text-current uppercase opacity-60">
            {caption}
          </span>
        )}
        {children}
      </div>
      {self && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
