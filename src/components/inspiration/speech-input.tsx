"use client";

import { useEffect, useRef } from "react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square } from "lucide-react";

interface SpeechInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SpeechInput({
  value,
  onChange,
  placeholder,
  disabled,
}: SpeechInputProps) {
  const {
    state,
    transcript,
    startRecording,
    stopRecording,
    isSupported,
    error,
  } = useVoiceRecorder();

  const prevTranscriptRef = useRef("");

  // Sync transcript from speech recognition into the parent's value
  useEffect(() => {
    if (state === "recording" && transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      onChange(transcript);
    }
  }, [transcript, state, onChange]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ??
            "What ingredients do you have? e.g. chicken thighs, lemon, fresh rosemary..."
          }
          rows={4}
          disabled={disabled || state === "recording"}
          className="pr-14"
        />
        {isSupported && (
          <button
            type="button"
            onClick={state === "recording" ? stopRecording : startRecording}
            disabled={disabled}
            className={`absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              state === "recording"
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            } disabled:opacity-50`}
          >
            {state === "recording" ? (
              <>
                <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
                <Square className="relative h-4 w-4" />
              </>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {state === "recording" && (
        <p className="text-xs text-destructive font-medium animate-pulse">
          Listening... tap mic to stop
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
