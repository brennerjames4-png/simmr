"use client";

import { useRef } from "react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, RotateCcw, Play, Pause } from "lucide-react";

interface VoiceRecorderProps {
  onTranscriptReady: (transcript: string) => void;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ onTranscriptReady, disabled }: VoiceRecorderProps) {
  const {
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
  } = useVoiceRecorder();
  const audioRef = useRef<HTMLAudioElement>(null);
  const isPlayingRef = useRef(false);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlayingRef.current) {
      audio.pause();
      isPlayingRef.current = false;
    } else {
      audio.play();
      isPlayingRef.current = true;
      audio.onended = () => {
        isPlayingRef.current = false;
      };
    }
  }

  // Fallback for unsupported browsers: show a textarea
  if (!isSupported) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Voice recording is not supported in this browser. You can type your
          recipe description instead.
        </p>
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Describe how you made this dish — ingredients, quantities, steps, cooking times..."
          rows={6}
        />
        <Button
          type="button"
          onClick={() => onTranscriptReady(transcript)}
          disabled={disabled || !transcript.trim()}
          className="w-full"
        >
          Generate Recipe
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Idle state */}
      {state === "idle" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Describe how you made this dish — ingredients, quantities, steps,
            cooking times. Be as detailed as you like.
          </p>
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Mic className="h-8 w-8" />
          </button>
          <p className="text-xs text-muted-foreground">Tap to record</p>
        </div>
      )}

      {/* Recording state */}
      {state === "recording" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
            <button
              type="button"
              onClick={stopRecording}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            >
              <Square className="h-6 w-6" />
            </button>
          </div>
          <div className="text-center">
            <p className="text-lg font-mono font-semibold">
              {formatTime(duration)}
            </p>
            <p className="text-xs text-muted-foreground">
              Recording... tap to stop
            </p>
          </div>
          {transcript && (
            <div className="w-full rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground max-h-24 overflow-y-auto">
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* Recorded state */}
      {state === "recorded" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Your description</p>
            <span className="text-xs text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>

          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Transcript will appear here..."
            rows={5}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Edit the transcript above if needed before generating.
          </p>

          {audioUrl && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={togglePlayback}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Play back
              </Button>
              <audio ref={audioRef} src={audioUrl} />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetRecording}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Re-record
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={() => onTranscriptReady(transcript)}
              disabled={disabled || !transcript.trim()}
            >
              Generate Recipe
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
