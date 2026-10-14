import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useVoiceInput } from '@/lib/use-voice-input';

class Speech {
  static instances: Speech[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onresult:
    | ((e: {
        resultIndex: number;
        results: { isFinal: boolean; 0: { transcript: string } }[];
      }) => void)
    | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    Speech.instances.push(this);
  }
  result(text: string, final = true) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  Speech.instances = [];
  Object.defineProperty(window, 'SpeechRecognition', { value: Speech, configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const setup = (continuous = true) => {
  const onTranscript = vi.fn(),
    onError = vi.fn();
  const hook = renderHook(() =>
    useVoiceInput({ language: 'ta-IN', continuous, onTranscript, onError }),
  );
  act(() => hook.result.current.start());
  return { ...hook, onTranscript, onError, speech: Speech.instances.at(-1)! };
};

test('mobile replayed final indices are delivered once; interim never becomes saved text', () => {
  const { speech, onTranscript, result } = setup();
  expect(speech.lang).toBe('ta-IN');
  act(() => speech.result('Vik', false));
  expect(result.current.interim).toBe('Vik');
  expect(onTranscript).not.toHaveBeenCalled();
  act(() => speech.result('Vikram'));
  act(() => speech.result('Vikram'));
  expect(onTranscript).toHaveBeenCalledExactlyOnceWith('Vikram');
});
test('mobile natural end resumes, and Stop cancels a queued restart', () => {
  const { speech, result, onTranscript } = setup();
  act(() => speech.result('Vikram'));
  act(() => speech.onend?.());
  expect(result.current.status).toBe('starting');
  act(() => vi.advanceTimersByTime(350));
  const second = Speech.instances.at(-1)!;
  expect(Speech.instances).toHaveLength(2);
  expect(result.current.status).toBe('listening');
  act(() => second.result('Kaithi'));
  expect(onTranscript).toHaveBeenCalledTimes(2);
  act(() => second.onend?.());
  act(() => result.current.stop());
  act(() => vi.advanceTimersByTime(2000));
  expect(Speech.instances).toHaveLength(2);
  expect(result.current.status).toBe('idle');
});
test('permission errors do not retry; repeated empty ends have a bounded recovery', () => {
  const { speech, result, onError } = setup();
  act(() => speech.onerror?.({ error: 'not-allowed' }));
  act(() => vi.advanceTimersByTime(2000));
  expect(Speech.instances).toHaveLength(1);
  expect(result.current.active).toBe(false);
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('permission was denied'));
  act(() => result.current.start());
  for (let i = 0; i < 3; i++) {
    act(() => Speech.instances.at(-1)!.onend?.());
    act(() => vi.advanceTimersByTime(350));
  }
  expect(result.current.active).toBe(false);
  expect(onError).toHaveBeenLastCalledWith(expect.stringContaining('Listening paused'));
});
test('switching voice sessions aborts the previous microphone immediately', () => {
  const first = setup();
  const staleResult = first.speech.onresult;
  const second = setup();
  expect(first.speech.abort).toHaveBeenCalledOnce();
  expect(first.result.current.active).toBe(false);
  expect(second.result.current.active).toBe(true);
  act(() =>
    staleResult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'stale' } }] }),
  );
  expect(first.onTranscript).not.toHaveBeenCalled();
});
test('backgrounding aborts capture and never automatically resumes', () => {
  const { speech, result } = setup();
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(speech.abort).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(20000));
  expect(result.current.active).toBe(false);
  expect(Speech.instances).toHaveLength(1);
});
