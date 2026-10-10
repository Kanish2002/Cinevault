'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type SpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: { length: number; [index: number]: SpeechResult };
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
type Status = 'idle' | 'starting' | 'listening' | 'stopping';
export function useVoiceInput({
  language,
  continuous = false,
  onTranscript,
  onError,
}: {
  language: string;
  continuous?: boolean;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}) {
  const id = useId();
  const [status, setStatus] = useState<Status>('idle');
  const [interim, setInterim] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onTranscript, onError });
  useEffect(() => {
    callbacks.current = { onTranscript, onError };
  }, [onTranscript, onError]);
  const stop = useCallback(() => {
    const current = recognition.current;
    if (!current) return;
    setStatus('stopping');
    try {
      current.stop();
    } catch {
      /* Finish below if the service has already ended. */
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (recognition.current !== current) return;
      recognition.current = null;
      current.onresult = current.onend = current.onerror = current.onstart = null;
      try {
        current.abort();
      } catch {
        /* Already stopped. */
      }
      setStatus('idle');
      setInterim('');
    }, 2000);
  }, []);
  useEffect(() => {
    const otherSession = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) stop();
    };
    window.addEventListener('cinevault-voice-start', otherSession);
    return () => {
      window.removeEventListener('cinevault-voice-start', otherSession);
      clearTimeout(timer.current);
      const current = recognition.current;
      recognition.current = null;
      if (current) {
        current.onresult = current.onend = current.onerror = current.onstart = null;
        try {
          current.abort();
        } catch {
          /* Service already ended. */
        }
      }
    };
  }, [id, stop]);
  const start = () => {
    if (recognition.current) return;
    const w = window as VoiceWindow;
    const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Speech) {
      callbacks.current.onError(
        'Voice search is not supported in this browser. Type your titles or try Chrome on Android.',
      );
      return;
    }
    window.dispatchEvent(new CustomEvent('cinevault-voice-start', { detail: id }));
    const current = new Speech();
    current.lang = language;
    current.continuous = continuous;
    current.interimResults = true;
    const finish = () => {
      if (recognition.current !== current) return;
      recognition.current = null;
      clearTimeout(timer.current);
      setStatus('idle');
      setInterim('');
    };
    current.onstart = () => {
      if (recognition.current === current) setStatus('listening');
    };
    current.onresult = (event) => {
      if (recognition.current !== current) return;
      const pending: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (text) callbacks.current.onTranscript(text);
        } else pending.push(text);
      }
      setInterim(pending.join(' '));
    };
    current.onerror = ({ error }) => {
      const message =
        error === 'not-allowed' || error === 'service-not-allowed'
          ? 'Microphone permission was denied. Allow microphone access or type your titles.'
          : error === 'no-speech'
            ? 'No speech was heard. Try the microphone again or type your titles.'
            : error === 'audio-capture'
              ? 'No microphone is available. Connect one or type your titles.'
              : `Voice input stopped (${error}). Try again or type your titles.`;
      if (error !== 'aborted' && recognition.current === current)
        callbacks.current.onError(message);
      finish();
    };
    current.onend = finish;
    recognition.current = current;
    setStatus('starting');
    setInterim('');
    try {
      current.start();
    } catch {
      finish();
      callbacks.current.onError('The microphone could not start. Try again or type your titles.');
    }
  };
  return { status, active: status !== 'idle', interim, start, stop };
}

export function spokenMovieTitles(text: string) {
  return text
    .split(/\n|[,;]|\b(?:new line|next (?:movie|title))\b/gi)
    .map((title) =>
      title
        .trim()
        .replace(/^(?:add|save|search(?: for)?|find)\s+/i, '')
        .replace(/[.!?]+$/, '')
        .trim(),
    )
    .filter(Boolean);
}
