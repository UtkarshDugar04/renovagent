"use client";

// Cross-browser transcription fallback for browsers without native
// SpeechRecognition (Firefox, Safari). Records the local mic in short,
// self-contained chunks, resamples each to 16kHz mono, and runs them
// through an in-browser Whisper model (Hugging Face's transformers.js) —
// entirely client-side, no vendor, no account. The library is
// dynamically imported so Chrome/Edge users (who use the free native API
// instead) never download it.
//
// Trade-off vs the native-API path: chunked rather than continuous, so
// there's a multi-second lag per utterance, and the model (~40-100MB) has
// to download once on first use. Runs on the main thread rather than a
// Web Worker — Turbopack doesn't yet compile `new Worker(new URL(...))`
// into a runnable bundle (it copies the raw source as a static asset),
// so a worker-based version would silently fail at runtime.

import { useEffect, useRef, useState } from "react";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

const CHUNK_MS = 4000;
let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en") as Promise<AutomaticSpeechRecognitionPipeline>
    );
  }
  return transcriberPromise;
}

async function resampleTo16kMono(decoded: AudioBuffer): Promise<Float32Array> {
  const targetRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * targetRate)),
    targetRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0).slice();
}

export function useWhisperTranscription(
  active: boolean,
  stream: MediaStream | null,
  onFinalSegment: (text: string) => void
) {
  const [modelLoading, setModelLoading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const onFinalSegmentRef = useRef(onFinalSegment);
  onFinalSegmentRef.current = onFinalSegment;
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!active || !stream || stream.getAudioTracks().length === 0) return;

    stoppedRef.current = false;
    const audioStream = new MediaStream(stream.getAudioTracks());

    async function transcribeChunk(pcm: Float32Array) {
      const isFirstLoad = transcriberPromise === null;
      if (isFirstLoad) setModelLoading(true);
      try {
        const transcriber = await getTranscriber();
        setModelLoading(false);
        const result = await transcriber(pcm);
        const text = ((Array.isArray(result) ? result[0]?.text : result.text) ?? "").trim();
        if (text && !stoppedRef.current) onFinalSegmentRef.current(text);
      } catch {
        setModelLoading(false);
      }
    }

    function recordChunk() {
      if (stoppedRef.current) return;
      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(audioStream);
      } catch {
        return;
      }
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunks.length > 0) {
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType });
            const arrayBuffer = await blob.arrayBuffer();
            const audioCtx = new AudioContext();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            await audioCtx.close();
            if (decoded.duration > 0.3) {
              const pcm = await resampleTo16kMono(decoded);
              // Fire-and-forget — the next chunk starts recording
              // immediately rather than waiting on this one to transcribe.
              void transcribeChunk(pcm);
            }
          } catch {
            // A malformed/empty chunk (e.g. near-silent audio) — skip it,
            // the next chunk will pick back up.
          }
        }
        if (!stoppedRef.current) recordChunk();
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, CHUNK_MS);
    }

    recordChunk();

    return () => {
      stoppedRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, [active, stream]);

  return { modelLoading };
}
