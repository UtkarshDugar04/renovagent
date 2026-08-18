"use client";

// Real-time speech-to-text for one participant's own microphone, using the
// browser-native Web Speech API — zero cost, zero account, zero API key.
// Chrome and Edge only (no Safari/Firefox support as of this writing); the
// caller should feature-detect via `isSupported` and degrade gracefully.
//
// Each participant's browser transcribes only their own mic locally, then
// the caller (CallRoom) posts finalized segments up as conversation
// messages — so a two-person call naturally produces two correctly
// speaker-tagged transcript streams without any server-side audio mixing.

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useLiveTranscription(active: boolean, onFinalSegment: (text: string) => void) {
  const [isSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalSegmentRef = useRef(onFinalSegment);
  onFinalSegmentRef.current = onFinalSegment;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimText("");
  }, []);

  useEffect(() => {
    if (!active || !isSupported) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const trimmed = transcript.trim();
          if (trimmed) onFinalSegmentRef.current(trimmed);
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    // Chrome's recognizer stops itself after periods of silence or ~60s —
    // restart automatically whenever it ends while the call is still active.
    recognition.onend = () => {
      if (active) {
        try {
          recognition.start();
        } catch {
          // already starting — ignore.
        }
      }
    };

    recognition.onerror = () => {
      // no-speech / audio-capture errors fire onend right after; the
      // restart above handles them.
    };

    recognitionRef.current = recognition;
    recognition.start();

    return () => {
      recognition.onend = null;
      stop();
    };
  }, [active, isSupported, stop]);

  return { isSupported, interimText };
}
