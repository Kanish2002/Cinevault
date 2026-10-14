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
  const desired = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onTranscript, onError });
  useEffect(() => {
    callbacks.current = { onTranscript, onError };
  }, [onTranscript, onError]);

  // Abort synchronously when switching microphones or leaving the foreground.
  // stop() is reserved for the user's Stop action, so the service can deliver its final result.
  const cancel = useCallback(() => {
    desired.current = false;
    clearTimeout(timer.current);
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onresult = current.onend = current.onerror = current.onstart = null;
      try {
        current.abort();
      } catch {
        /* Already ended. */
      }
    }
    setStatus('idle');
    setInterim('');
  }, []);
  const stop = useCallback(() => {
    desired.current = false;
    clearTimeout(timer.current);
    const current = recognition.current;
    if (!current) {
      setStatus('idle');
      return;
    }
    setStatus('stopping');
    // Register timeout before stop: some implementations end synchronously.
    timer.current = setTimeout(cancel, 2500);
    try {
      current.stop();
    } catch {
      cancel();
    }
  }, [cancel]);
  useEffect(() => {
    const other = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) cancel();
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('cinevault-voice-start', other);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', cancel);
    return () => {
      window.removeEventListener('cinevault-voice-start', other);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', cancel);
      cancel();
    };
  }, [id, cancel]);
  useEffect(() => {
    cancel();
  }, [language, cancel]);

  const start = () => {
    if (desired.current || recognition.current) return;
    const w = window as VoiceWindow;
    const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Speech) {
      callbacks.current.onError(
        'Voice search is not supported in this browser. Type your titles or try Chrome on Android.',
      );
      return;
    }
    window.dispatchEvent(new CustomEvent('cinevault-voice-start', { detail: id }));
    desired.current = true;
    let emptyEnds = 0;
    const launch = () => {
      if (!desired.current || document.hidden) {
        cancel();
        return;
      }
      let current: Recognition;
      try {
        current = new Speech();
      } catch {
        cancel();
        callbacks.current.onError('The microphone could not start. Try again or type your titles.');
        return;
      }
      current.lang = language;
      current.continuous = continuous;
      current.interimResults = true;
      // Android can replay the entire result list with resultIndex=0. Each final
      // index belongs to this recognition instance and must be delivered once.
      const delivered = new Set<number>();
      let heard = false;
      const finish = () => {
        if (recognition.current !== current) return;
        recognition.current = null;
        clearTimeout(timer.current);
        current.onstart = current.onresult = current.onerror = current.onend = null;
        setInterim('');
        if (continuous && desired.current && !document.hidden) {
          emptyEnds = heard ? 0 : emptyEnds + 1;
          if (emptyEnds < 3) {
            setStatus('starting');
            timer.current = setTimeout(launch, 350);
            return;
          }
          callbacks.current.onError(
            'Listening paused. Tap Speak titles to continue; your titles are kept.',
          );
        }
        desired.current = false;
        setStatus('idle');
      };
      current.onstart = () => {
        if (recognition.current !== current) return;
        if (!desired.current) {
          try {
            current.stop();
          } catch {
            cancel();
          }
          return;
        }
        clearTimeout(timer.current);
        setStatus('listening');
      };
      current.onresult = (event) => {
        if (recognition.current !== current) return;
        const pending: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript.trim();
          if (result.isFinal && !delivered.has(i)) {
            delivered.add(i);
            if (text) {
              heard = true;
              callbacks.current.onTranscript(text);
            }
          } else if (!result.isFinal && text) pending.push(text);
        }
        setInterim(pending.join(' '));
      };
      current.onerror = ({ error }) => {
        if (recognition.current !== current) return;
        // No-speech is a recoverable mobile silence timeout. All other errors
        // finish the session and never enter an automatic permission/retry loop.
        if (error === 'no-speech' && continuous && desired.current) {
          finish();
          return;
        }
        desired.current = false;
        const message =
          error === 'not-allowed' || error === 'service-not-allowed'
            ? 'Microphone permission was denied. Allow microphone access or type your titles.'
            : error === 'no-speech'
              ? 'No speech was heard. Try the microphone again or type your titles.'
              : error === 'audio-capture'
                ? 'No microphone is available. Connect one or type your titles.'
                : `Voice input stopped (${error}). Try again or type your titles.`;
        if (error !== 'aborted') callbacks.current.onError(message);
        finish();
      };
      current.onend = finish;
      recognition.current = current;
      setStatus('starting');
      setInterim('');
      timer.current = setTimeout(() => {
        cancel();
        callbacks.current.onError(
          'The microphone did not respond. Check microphone access and try again, or type your titles.',
        );
      }, 12000);
      try {
        current.start();
      } catch {
        cancel();
        callbacks.current.onError('The microphone could not start. Try again or type your titles.');
      }
    };
    launch();
  };
  return { status, active: status !== 'idle', interim, start, stop, cancel };
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
