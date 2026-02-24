"use client";

import { useState, useRef, useCallback } from "react";

export type RecorderState = "idle" | "recording" | "recorded";

interface UseVoiceRecorderReturn {
  state: RecorderState;
  transcript: string;
  setTranscript: (value: string) => void;
  duration: number;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
  isSupported: boolean;
  error: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTranscriptRef = useRef("");

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) &&
    "MediaRecorder" in window;

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    setDuration(0);
    setAudioUrl(null);
    chunksRef.current = [];
    finalTranscriptRef.current = "";

    try {
      // Start SpeechRecognition
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscriptRef.current + interim);
      };

      recognition.onerror = (e: Event & { error: string }) => {
        console.error("SpeechRecognition error:", e.error);
        if (e.error === "not-allowed") {
          setError("Microphone access denied. Please allow it in your browser settings.");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

      // Start MediaRecorder for playback
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      // Timer
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      setState("recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(
        "Microphone access is needed to record. Please allow it in your browser settings."
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setState("recorded");
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setTranscript("");
    setDuration(0);
    setAudioUrl(null);
    setError(null);
    finalTranscriptRef.current = "";
    setState("idle");
  }, [audioUrl]);

  return {
    state,
    transcript,
    setTranscript,
    duration,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    isSupported,
    error,
  };
}
