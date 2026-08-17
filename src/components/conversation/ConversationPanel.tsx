"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  }, [messages]);

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
          <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Tell Renovagent about your home and what&apos;s not working — start anywhere.
            </p>
          </div>
        )}
        {messages.map((m) => {
          const isHomeowner = m.sender_role === "homeowner";
          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${isHomeowner ? "justify-end" : "justify-start"}`}
            >
              {!isHomeowner && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/20">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isHomeowner
                    ? "bg-primary text-primary-foreground glow-primary"
                    : "glass text-foreground"
                }`}
              >
                {m.text}
              </div>
              {isHomeowner && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    <User className="h-3.5 w-3.5 text-secondary-foreground" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
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

      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingAttachments.map((a) => (
            <span
              key={a.id}
              className="glass rounded-full px-2.5 py-1 text-xs text-muted-foreground"
            >
              {a.label}
            </span>
          ))}
        </div>
      )}

      <div className="glass flex items-center gap-2 rounded-full border border-white/10 p-1.5">
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
          className="h-9 w-9 shrink-0 rounded-full glow-primary"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
