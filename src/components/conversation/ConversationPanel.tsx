"use client";

import { useState, useRef, useEffect } from "react";
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

    // Optimistic append of the user's own message.
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
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <p className="text-sm text-stone-400">
            Tell Renovagent about your home and what&apos;s not working — start anywhere.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender_role === "homeowner" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                m.sender_role === "homeowner"
                  ? "bg-stone-900 text-white"
                  : "bg-white border border-stone-200 text-stone-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {openQuestions.length > 0 && (
        <div className="mb-3 space-y-2">
          {openQuestions.slice(0, 1).map((q) => (
            <div
              key={q.id}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <span className="font-medium">Renovagent is also wondering: </span>
              {q.question_text}
            </div>
          ))}
        </div>
      )}

      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingAttachments.map((a) => (
            <span
              key={a.id}
              className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
            >
              📎 {a.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 border-t border-stone-200 pt-3">
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
          className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm outline-none focus:border-stone-500"
        />
        <button
          onClick={send}
          disabled={sending || (!draft.trim() && pendingAttachments.length === 0)}
          className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
