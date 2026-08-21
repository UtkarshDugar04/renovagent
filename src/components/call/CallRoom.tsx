"use client";

import { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Sparkles,
  Radio,
  Send,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChatBubble } from "@/components/shared/ChatBubble";
import { createClient } from "@/lib/supabase/client";
import { useCallSession } from "@/lib/webrtc/useCallSession";
import { useLiveTranscription } from "@/lib/webrtc/useLiveTranscription";
import { useWhisperTranscription } from "@/lib/webrtc/useWhisperTranscription";
import { joinOrStartCallSession, endCallSession, sendToYoxaAction } from "./actions";

interface Message {
  id: string;
  sender_role: string;
  text: string;
  turn_type: string;
  created_at: string;
}

export function CallRoom({
  projectId,
  selfId,
  currentRole,
  initialActiveCallSessionId,
  initialMessages,
  alreadySentToYoxa = false,
}: {
  projectId: string;
  selfId: string;
  currentRole: "homeowner" | "agency" | "admin";
  initialActiveCallSessionId: string | null;
  initialMessages: Message[];
  alreadySentToYoxa?: boolean;
}) {
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [typedDraft, setTypedDraft] = useState("");
  // A count, not a boolean: live-call fragments can arrive faster than a
  // real Gemini reply comes back, so more than one of these can be in
  // flight at once.
  const [pendingReplies, setPendingReplies] = useState(0);
  const [hasOtherActiveSession, setHasOtherActiveSession] = useState(
    initialActiveCallSessionId !== null
  );
  const [sentToYoxa, setSentToYoxa] = useState(alreadySentToYoxa);
  const [sending, setSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const feedBottomRef = useRef<HTMLDivElement>(null);

  async function postSegment(text: string) {
    // No optimistic local insert here: the realtime subscription below
    // already adds this exact row once the server inserts it, deduped by
    // its real id. An optimistic entry needs a synthetic id (the real one
    // doesn't exist yet), which the realtime handler's id-based dedup can
    // never match against the row that arrives moments later — the same
    // segment ends up rendered twice. Realtime latency here is sub-second,
    // so the round trip is not perceptible.
    setPendingReplies((n) => n + 1);

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, turnType: "call_transcript", callSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setMessages((prev) => [...prev, data.reply]);
        }
      }
    } finally {
      setPendingReplies((n) => n - 1);
    }
  }

  const {
    connectionState,
    localStream,
    remoteStream,
    micEnabled,
    mediaError,
    toggleMic,
    endCall,
  } = useCallSession(callSessionId, selfId);

  const {
    isSupported: nativeTranscriptionSupported,
    checked: nativeTranscriptionChecked,
    interimText,
  } = useLiveTranscription(Boolean(localStream), (text) => postSegment(text));

  // Firefox/Safari have no native SpeechRecognition — fall back to an
  // in-browser Whisper model. Only starts once the native check has
  // resolved, so it never briefly spins up on Chrome/Edge before that
  // check flips isSupported to true.
  const useWhisperFallback = nativeTranscriptionChecked && !nativeTranscriptionSupported;
  const { modelLoading: whisperModelLoading } = useWhisperTranscription(
    useWhisperFallback && Boolean(localStream),
    localStream,
    (text) => postSegment(text)
  );
  const transcriptionSupported = nativeTranscriptionSupported || useWhisperFallback;

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText, pendingReplies]);

  // Live feed subscription, independent of the whole-page realtime
  // refresher — a call needs sub-second updates, not a full route refetch
  // every time a transcript fragment lands.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`call-feed:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          if (row.status === "active") setHasOtherActiveSession(true);
          if (row.status === "ended") setHasOtherActiveSession(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_sessions", filter: `project_id=eq.${projectId}` },
        () => setHasOtherActiveSession(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  async function sendTyped() {
    const text = typedDraft.trim();
    if (!text) return;
    setTypedDraft("");

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_role: currentRole,
      text,
      turn_type: "new_message",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setPendingReplies((n) => n + 1);

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, turnType: "new_message", callSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) setMessages((prev) => [...prev, data.reply]);
      }
    } finally {
      setPendingReplies((n) => n - 1);
    }
  }

  async function handleJoin() {
    setJoining(true);
    const result = await joinOrStartCallSession(projectId);
    setJoining(false);
    if ("callSessionId" in result && result.callSessionId) {
      setCallSessionId(result.callSessionId);
    }
  }

  async function handleEnd() {
    if (callSessionId) await endCallSession(callSessionId, projectId);
    endCall();
    setCallSessionId(null);
  }

  async function handleSendToYoxa() {
    setSending(true);
    setSendError(null);
    const result = await sendToYoxaAction(projectId);
    setSending(false);
    if (result.ok) {
      setSentToYoxa(true);
      setConfirmingSend(false);
    } else {
      setSendError(result.error ?? "Something went wrong sending this to Yoxa.");
    }
  }

  const inCall = callSessionId !== null && connectionState !== "ended" && connectionState !== "idle";
  const canSendToYoxa = (currentRole === "agency" || currentRole === "admin") && !inCall && messages.length > 0;

  return (
    <div className="space-y-4">
      {currentRole === "agency" || currentRole === "admin" ? (
        <SendToYoxaPanel
          sentToYoxa={sentToYoxa}
          canSend={canSendToYoxa}
          inCall={inCall}
          sending={sending}
          confirming={confirmingSend}
          error={sendError}
          onStartConfirm={() => setConfirmingSend(true)}
          onCancelConfirm={() => setConfirmingSend(false)}
          onConfirm={handleSendToYoxa}
        />
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {sentToYoxa ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
              Sent to Yoxa — planning and design work has started.
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 shrink-0" />
              Your agency reviews this conversation and sends it on to planning when it&apos;s ready
              — nothing for you to do here.
            </>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative grid grid-cols-2 gap-px bg-border">
            <VideoTile
              ref={localVideoRef}
              label="You"
              muted
              active={Boolean(localStream)}
              cameraOff
            />
            <VideoTile
              ref={remoteVideoRef}
              label={currentRole === "homeowner" ? "Agency" : "Homeowner"}
              active={Boolean(remoteStream)}
              cameraOff
              waiting={inCall && !remoteStream}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusDot state={connectionState} />
              {mediaError ?? statusLabel(connectionState)}
            </div>
            <div className="flex items-center gap-2">
              {!inCall ? (
                <Button onClick={handleJoin} disabled={joining}>
                  <Phone className="h-4 w-4" />
                  {hasOtherActiveSession ? "Join call" : "Start call"}
                </Button>
              ) : (
                <>
                  <Button size="icon" variant="outline" onClick={toggleMic} title={micEnabled ? "Mute" : "Unmute"}>
                    {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-destructive" />}
                  </Button>
                  <Button size="icon" onClick={handleEnd} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" title="End call">
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {nativeTranscriptionChecked && !transcriptionSupported && (
          <Alert className="border-accent/30 bg-accent/10">
            <AlertDescription className="text-xs">
              Live transcription isn&apos;t available in this browser — the call itself still works,
              but Renovagent won&apos;t automatically hear what&apos;s said. Type key points into the
              feed instead.
            </AlertDescription>
          </Alert>
        )}

        {useWhisperFallback && whisperModelLoading && (
          <Alert className="border-accent/30 bg-accent/10">
            <AlertDescription className="text-xs">
              Loading an in-browser speech model (one-time, a moment on this connection)… Renovagent
              will start hearing what&apos;s said in a few seconds, transcribed in short chunks rather
              than live word-by-word.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex h-[560px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pb-3">
          {messages.length === 0 && (
            <EmptyState
              icon={Radio}
              iconClassName="text-primary"
              description="Start the call — Renovagent listens in and drops questions here as things come up."
            />
          )}
          {messages.map((m) => (
            <FeedRow key={m.id} message={m} />
          ))}
          {interimText && (
            <div className="flex items-end justify-end gap-2 opacity-60">
              <div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2 text-sm italic text-primary-foreground">
                {interimText}…
              </div>
            </div>
          )}
          {pendingReplies > 0 && <ThinkingBubble />}
          <div ref={feedBottomRef} />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5">
          <input
            value={typedDraft}
            onChange={(e) => setTypedDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendTyped();
              }
            }}
            placeholder="Type instead of speaking…"
            className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="icon" onClick={sendTyped} disabled={!typedDraft.trim()} className="h-9 w-9 shrink-0 rounded-full">
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function SendToYoxaPanel({
  sentToYoxa,
  canSend,
  inCall,
  sending,
  confirming,
  error,
  onStartConfirm,
  onCancelConfirm,
  onConfirm,
}: {
  sentToYoxa: boolean;
  canSend: boolean;
  inCall: boolean;
  sending: boolean;
  confirming: boolean;
  error: string | null;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
}) {
  if (sentToYoxa) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Sent to Yoxa — planning and design work has started.
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-2 rounded-2xl border border-primary/20 bg-card px-4 py-3">
        <div className="flex items-start gap-2 text-sm text-foreground/90">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            This sends everything captured in this conversation to Yoxa to start planning — it&apos;s a
            one-time action, there&apos;s no undo or resubmission for this project. Send now?
          </span>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} disabled={sending}>
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Yes, send to Yoxa"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelConfirm} disabled={sending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {inCall
          ? "Send to Yoxa becomes available once the call has ended."
          : canSend
            ? "Covered family, space, preferences, budget, and constraints? Send when ready — Yoxa reviews completeness itself and comes back with a confirmation step if anything needs more detail."
            : "Nothing to send yet — the conversation is empty."}
      </p>
      <Button size="sm" onClick={onStartConfirm} disabled={!canSend} variant="outline">
        <Send className="h-3.5 w-3.5" />
        Send to Yoxa
      </Button>
    </div>
  );
}

function ThinkingBubble() {
  return (
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
  );
}

function FeedRow({ message }: { message: Message }) {
  const isAdmin = message.sender_role === "admin";
  const isTranscript = message.turn_type === "call_transcript";
  return (
    <ChatBubble self={!isAdmin} caption={isTranscript ? `${message.sender_role} · spoken` : undefined}>
      {message.text}
    </ChatBubble>
  );
}

function StatusDot({ state }: { state: string }) {
  const color =
    state === "connected"
      ? "bg-emerald-400"
      : state === "connecting" || state === "waiting"
        ? "bg-amber-400"
        : state === "failed"
          ? "bg-destructive"
          : "bg-muted-foreground";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function statusLabel(state: string) {
  switch (state) {
    case "idle":
      return "Not connected";
    case "waiting":
      return "Setting up your camera & mic…";
    case "connecting":
      return "Connecting to the other side…";
    case "connected":
      return "Live";
    case "ended":
      return "Call ended";
    case "failed":
      return "Couldn't connect — try again";
    default:
      return state;
  }
}

const VideoTile = ({
  ref,
  label,
  muted,
  active,
  cameraOff,
  waiting,
}: {
  ref: React.RefObject<HTMLVideoElement | null>;
  label: string;
  muted?: boolean;
  active: boolean;
  cameraOff: boolean;
  waiting?: boolean;
}) => (
  <div className="relative flex aspect-video items-center justify-center bg-black/40">
    {active && !cameraOff ? (
      <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
    ) : (
      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-secondary text-sm">{label.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-xs">{waiting ? "Waiting to join…" : cameraOff ? "Camera off" : "Not connected"}</span>
      </div>
    )}
    <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
      {label}
    </span>
  </div>
);
