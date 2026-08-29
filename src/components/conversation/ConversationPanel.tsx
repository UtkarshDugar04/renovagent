"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChatBubble } from "@/components/shared/ChatBubble";
import { AttachmentButton, type UploadedAttachment } from "./AttachmentButton";

interface Message {
  id: string;
  sender_role: string;
  text: string;
  created_at: string;
}

interface OpenQuestion {
  id: string;
  question_text: string;
  domain: string | null;
  severity: string;
}

export function ConversationPanel({
  projectId,
  initialMessages,
  openQuestions,
}: {
  projectId: string;
  initialMessages: Message[];
  openQuestions: OpenQuestion[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || sending) return;

    setSending(true);
    setDraft("");
    const attachmentsToSend = pendingAttachments;
    setPendingAttachments([]);

    const optimisticText =
      text || `Sent ${attachmentsToSend.length} file${attachmentsToSend.length > 1 ? "s" : ""}`;
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_role: "homeowner",
      text: optimisticText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: optimisticText,
          attachmentIds: attachmentsToSend.map((a) => a.id),
        }),
      });

      if (!res.ok) {
        throw new Error("Renovagent couldn't complete this analysis right now.");
      }

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, data.reply]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender_role: "admin",
          text: "Renovagent couldn't complete this right now. Nothing in your project has been lost — try sending that again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <EmptyState
            icon={Sparkles}
            iconClassName="text-primary"
            description="Tell Renovagent about your home and what's not working — start anywhere."
          />
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} self={m.sender_role === "homeowner"}>
            {m.text}
          </ChatBubble>
        ))}
        {sending && (
          <div className="flex items-end gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-card px-4 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {openQuestions.length > 0 && (
        <div className="mb-3">
          {openQuestions.slice(0, 1).map((q) => (
            <Alert key={q.id} className="border-accent/30 bg-accent/10">
              <AlertDescription className="text-sm">
                <span className="font-medium text-accent">Renovagent is also wondering: </span>
                {q.question_text}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <p className="mb-1.5 text-xs text-muted-foreground">
        Have room photos or a floor plan? Attach them below — that&apos;s the only way the
        spatial model and design visuals can reflect your real room instead of a guess.
      </p>

      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingAttachments.map((a) =>
            a.previewUrl ? (
              <img
                key={a.id}
                src={a.previewUrl}
                alt={a.label}
                title={a.label}
                className="h-10 w-10 rounded-md border border-border object-cover"
              />
            ) : (
              <span
                key={a.id}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
              >
                {a.label}
              </span>
            )
          )}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5">
        <AttachmentButton
          projectId={projectId}
          onUploaded={(a) => setPendingAttachments((prev) => [...prev, a])}
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message Renovagent…"
          className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="icon"
          onClick={send}
          disabled={sending || (!draft.trim() && pendingAttachments.length === 0)}
          className="h-9 w-9 shrink-0 rounded-full"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
