"use client";

// Peer-to-peer WebRTC calling with Supabase Realtime Broadcast as the
// signaling channel — no calling vendor, no API key, no account, entirely
// free. STUN is Google's public server; there is intentionally no TURN
// relay (that requires a paid/account service), so calls across strict
// corporate NATs may fail to connect directly. Fine for the common case of
// two people on normal home/office networks.
//
// One RTCPeerConnection per pair. The first participant present in the
// signaling channel becomes the "offerer" once a second participant joins.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export type CallConnectionState = "idle" | "waiting" | "connecting" | "connected" | "ended" | "failed";

interface SignalPayload {
  from: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export function useCallSession(callSessionId: string | null, selfId: string) {
  const [connectionState, setConnectionState] = useState<CallConnectionState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef(false);
  const remotePresentRef = useRef(false);

  const teardown = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!callSessionId) return;
    let cancelled = false;

    async function start() {
      setConnectionState("waiting");
      setMediaError(null);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        try {
          // Camera denied/unavailable — still join with audio only rather
          // than failing the whole call.
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setMediaError("Camera unavailable — joined with audio only.");
        } catch (audioErr) {
          if (!cancelled) {
            setConnectionState("failed");
            setMediaError(
              audioErr instanceof Error && audioErr.name === "NotAllowedError"
                ? "Microphone and camera access was blocked — allow access in your browser and try again."
                : "Couldn't access a microphone or camera on this device."
            );
          }
          return;
        }
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        setConnectionState("connected");
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") setConnectionState("failed");
        if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
          setConnectionState((prev) => (prev === "connected" ? "ended" : prev));
        }
      };

      const supabase = createClient();
      const channel = supabase.channel(`call:${callSessionId}`, {
        config: { broadcast: { self: false }, presence: { key: selfId } },
      });
      channelRef.current = channel;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { from: selfId, candidate: event.candidate.toJSON() } satisfies SignalPayload,
          });
        }
      };

      channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
        const signal = payload as SignalPayload;
        if (signal.from === selfId) return;

        if (signal.sdp) {
          if (signal.sdp.type === "offer") {
            await pc.setRemoteDescription(signal.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (pc.localDescription) {
              channel.send({
                type: "broadcast",
                event: "signal",
                payload: { from: selfId, sdp: pc.localDescription.toJSON() } satisfies SignalPayload,
              });
            }
          } else if (signal.sdp.type === "answer") {
            await pc.setRemoteDescription(signal.sdp);
          }
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(signal.candidate);
          } catch {
            // Candidate arriving before remote description is set is
            // expected occasionally under this simple signaling scheme —
            // safe to drop.
          }
        }
      });

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((key) => key !== selfId);
        if (others.length > 0 && !remotePresentRef.current) {
          remotePresentRef.current = true;
          setConnectionState("connecting");
          // Deterministic offerer: lower id initiates, avoids both sides
          // racing to send an offer at once.
          if (selfId < others[0] && !makingOfferRef.current) {
            makingOfferRef.current = true;
            pc.createOffer().then(async (offer) => {
              await pc.setLocalDescription(offer);
              if (pc.localDescription) {
                channel.send({
                  type: "broadcast",
                  event: "signal",
                  payload: { from: selfId, sdp: pc.localDescription.toJSON() } satisfies SignalPayload,
                });
              }
            });
          }
        }
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joinedAt: Date.now() });
        }
      });
    }

    start();

    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callSessionId, selfId]);

  const toggleMic = useCallback(() => {
    setMicEnabled((prev) => {
      const next = !prev;
      localStream?.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    setCameraEnabled((prev) => {
      const next = !prev;
      localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, [localStream]);

  const endCall = useCallback(() => {
    teardown();
    setConnectionState("ended");
    setLocalStream(null);
    setRemoteStream(null);
  }, [teardown]);

  return { connectionState, localStream, remoteStream, micEnabled, cameraEnabled, mediaError, toggleMic, toggleCamera, endCall };
}
