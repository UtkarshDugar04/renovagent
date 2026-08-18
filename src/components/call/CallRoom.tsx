"use client";

import { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  User,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { useCallSession } from "@/lib/webrtc/useCallSession";
import { useLiveTranscription } from "@/lib/webrtc/useLiveTranscription";
import { joinOrStartCallSession, endCallSession } from "./actions";

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
}: {
  projectId: string;
  selfId: string;
  currentRole: "homeowner" | "agency" | "admin";
  initialActiveCallSessionId: string | null;
  initialMessages: Message[];
}) {
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [typedDraft, setTypedDraft] = useState("");
  const [hasOtherActiveSession, setHasOtherActiveSession] = useState(
    initialActiveCallSessionId !== null
  );

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const feedBottomRef = useRef<HTMLDivElement>(null);

  const {
    connectionState,
    localStream,
    remoteStream,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    endCall,
  } = useCallSession(callSessionId, selfId);

  const { isSupported: transcriptionSupported, interimText } = useLiveTranscription(
    Boolean(localStream),
    (text) => postSegment(text)
  );

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText]);

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

  async function postSegment(text: string) {
    const optimistic: Message = {
      id: `optimistic-${Date.now()}-${Math.random()}`,
      sender_role: currentRole,
      text,
      turn_type: "call_transcript",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

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
  }

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

    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, turnType: "new_message", callSessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) setMessages((prev) => [...prev, data.reply]);
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

  const inCall = callSessionId !== null && connectionState !== "ended" && connectionState !== "idle";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-3">
        <div className="glass overflow-hidden rounded-2xl">
          <div className="relative grid grid-cols-2 gap-px bg-white/5">
            <VideoTile
              ref={localVideoRef}
              label="You"
              muted
              active={Boolean(localStream)}
              cameraOff={!cameraEnabled}
            />
            <VideoTile
              ref={remoteVideoRef}
              label={currentRole === "homeowner" ? "Agency" : "Homeowner"}
              active={Boolean(remoteStream)}
              cameraOff={false}
              waiting={inCall && !remoteStream}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusDot state={connectionState} />
              {statusLabel(connectionState)}
            </div>
            <div className="flex items-center gap-2">
              {!inCall ? (
                <Button onClick={handleJoin} disabled={joining} className="glow-primary">
                  <Phone className="h-4 w-4" />
                  {hasOtherActiveSession ? "Join call" : "Start call"}
                </Button>
              ) : (
                <>
                  <Button size="icon" variant="outline" onClick={toggleMic} title={micEnabled ? "Mute" : "Unmute"}>
                    {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-destructive" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={toggleCamera} title={cameraEnabled ? "Turn camera off" : "Turn camera on"}>
                    {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-destructive" />}
                  </Button>
                  <Button size="icon" onClick={handleEnd} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" title="End call">
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {!transcriptionSupported && (
          <Alert className="border-accent/30 bg-accent/10">
            <AlertDescription className="text-xs">
              Live transcription needs Chrome or Edge — the call itself still works, but Renovagent
              won&apos;t automatically hear what&apos;s said. Type key points into the feed instead.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex h-[560px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pb-3">
          {messages.length === 0 && (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
              <Radio className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                Start the call — Renovagent listens in and drops questions here as things come up.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <FeedRow key={m.id} message={m} />
          ))}
          {interimText && (
            <div className="flex items-end justify-end gap-2 opacity-50">
              <div className="max-w-[75%] rounded-2xl bg-primary/40 px-4 py-2 text-sm italic text-primary-foreground">
                {interimText}…
              </div>
            </div>
          )}
          <div ref={feedBottomRef} />
        </div>

        <div className="glass flex items-center gap-2 rounded-full border border-white/10 p-1.5">
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
          <Button size="icon" onClick={sendTyped} disabled={!typedDraft.trim()} className="h-9 w-9 shrink-0 rounded-full glow-primary">
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeedRow({ message }: { message: Message }) {
  const isAdmin = message.sender_role === "admin";
  const isTranscript = message.turn_type === "call_transcript";
  return (
    <div className={`flex items-end gap-2 ${isAdmin ? "justify-start" : "justify-end"}`}>
      {isAdmin && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-primary/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAdmin ? "glass text-foreground" : "bg-primary text-primary-foreground glow-primary"
        }`}
      >
        {isTranscript && (
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide opacity-60">
            {message.sender_role} · spoken
          </span>
        )}
        {message.text}
      </div>
      {!isAdmin && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-secondary">
            <User className="h-3.5 w-3.5 text-secondary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
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
