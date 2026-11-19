import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpokenPrompt } from './browser-speech.ts';
import { prepareCaptions, startCaptions } from './local-captions.ts';

type Transcript = { text: string; complete: boolean };
type Recording = {
  stream: MediaStream;
  media: MediaRecorder;
  captions: Awaited<ReturnType<typeof startCaptions>>;
  text: string;
  failed: boolean;
  timer: number;
  audio: Promise<Blob | null>;
  finishAudio: (audio: Blob | null) => void;
  stopping?: Promise<Transcript>;
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}

async function waitFor<T>(work: Promise<T>, milliseconds: number, fallback: T): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([work, new Promise<T>(resolve => { timer = window.setTimeout(() => resolve(fallback), milliseconds); })]);
  } finally { window.clearTimeout(timer); }
}

export function useVoice(transcribe?: (audio: Blob) => Promise<string>) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'recording' | 'finishing'>('idle');
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const latestTranscript = useRef<Transcript>({ text: '', complete: false });
  const utterance = useRef<{ prompt: SpeechSynthesisUtterance; complete: (success: boolean) => void } | null>(null);
  const recording = useRef<Recording | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const canRecord = typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function';

  useEffect(() => () => {
    generation.current++;
    pending.current = false;
    const current = recording.current;
    recording.current = null;
    if (current) {
      window.clearTimeout(current.timer);
      current.captions.cancel();
      current.finishAudio(null);
      current.media.onstop = null;
      if (current.media.state !== 'inactive') current.media.stop();
      current.stream.getTracks().forEach(track => track.stop());
    }
    utterance.current?.complete(false);
    window.speechSynthesis?.cancel();
  }, []);

  const stop = useCallback((useBackup = true): Promise<Transcript> => {
    const current = recording.current;
    if (!current) {
      generation.current++;
      pending.current = false;
      setStatus('idle');
      return Promise.resolve(latestTranscript.current);
    }
    if (current.stopping) return current.stopping;
    setStatus('finishing');
    window.clearTimeout(current.timer);
    if (current.media.state !== 'inactive') current.media.stop();
    current.stopping = (async () => {
      let text = await current.captions.stop();
      current.stream.getTracks().forEach(track => track.stop());
      const clip = await waitFor(current.audio, 1500, null);
      if (recording.current !== current) return { text: '', complete: false };
      text = text || current.text;
      let complete = !current.failed && Boolean(text);
      if (clip && transcribe && useBackup && !complete) {
        try {
          const backup = await transcribe(clip);
          if (backup.trim()) { text = backup.trim().slice(0, 8000); complete = true; }
        } catch { /* Preserve the words already captured on this device. */ }
      }
      if (recording.current !== current) return { text: '', complete: false };
      recording.current = null;
      latestTranscript.current = { text, complete };
      setTranscript(text);
      setStatus('idle');
      setError(text && !complete ? 'Review your captured answer before sending it.' : '');
      return { text, complete };
    })();
    return current.stopping;
  }, [transcribe]);

  const start = useCallback(async (deviceId?: string) => {
    if (!canRecord || pending.current || recording.current) return;
    pending.current = true;
    const token = ++generation.current;
    latestTranscript.current = { text: '', complete: false };
    setError('');
    setTranscript('');
    setStatus('requesting');
    let stream: MediaStream | undefined;
    let captions: Recording['captions'] | undefined;
    let media: MediaRecorder | undefined;
    let stage: 'microphone' | 'captions' = 'microphone';
    try {
      // Begin loading while the browser requests microphone access.
      const preparing = prepareCaptions();
      void preparing.catch(() => undefined);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      stage = 'captions';
      await preparing;
      if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      captions = await startCaptions(stream, text => {
        if (token !== generation.current) return;
        if (recording.current) recording.current.text = text;
        setTranscript(text);
      }, () => {
        if (token !== generation.current) return;
        if (recording.current) recording.current.failed = true;
        setError('Captions were interrupted. Turn the microphone on again to retry.');
      });
      if (token !== generation.current) { captions.cancel(); stream.getTracks().forEach(track => track.stop()); return; }
      media = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const audio = deferred<Blob | null>();
      const current: Recording = {
        stream, media, captions, text: '', failed: false, timer: 0, audio: audio.promise, finishAudio: audio.resolve,
      };
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onstop = () => audio.resolve(chunks.length ? new Blob(chunks, { type: current.media.mimeType || chunks[0].type }) : null);
      media.onerror = () => { current.failed = true; audio.resolve(null); void stop(); };
      media.start();
      recording.current = current;
      current.timer = window.setTimeout(() => { void stop(); }, 90_000);
      setStatus('recording');
    } catch {
      captions?.cancel();
      if (media && media.state !== 'inactive') media.stop();
      stream?.getTracks().forEach(track => track.stop());
      if (token === generation.current) {
        setStatus('idle');
        setError(stage === 'microphone'
          ? 'Microphone access is unavailable. Check your browser permissions or type your answer.'
          : 'Captions could not start. Turn the microphone on again to retry.');
      }
    } finally {
      if (token === generation.current) pending.current = false;
    }
  }, [canRecord, stop]);

  const stopSpeaking = useCallback(() => {
    utterance.current?.complete(false);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string): Promise<boolean> => {
    const engine = window.speechSynthesis;
    if (!engine || typeof SpeechSynthesisUtterance === 'undefined') return false;
    stopSpeaking();
    setPlaybackError('');
    const play = (defaultVoice: boolean): Promise<boolean> => {
      const done = deferred<boolean>();
      const prompt = createSpokenPrompt(text, defaultVoice);
      let timer: number;
      let started = false;
      const complete = (success: boolean, retry = false) => {
        if (utterance.current?.prompt !== prompt) return;
        window.clearTimeout(timer);
        utterance.current = null;
        setSpeaking(false);
        done.resolve(retry ? play(true) : success);
      };
      const timeout = () => {
        complete(false);
        engine.cancel();
        setPlaybackError('Question audio timed out. Select Play question to try again.');
      };
      timer = window.setTimeout(timeout, 5000);
      utterance.current = { prompt, complete };
      prompt.onstart = () => {
        if (utterance.current?.prompt !== prompt) return;
        started = true;
        window.clearTimeout(timer);
        timer = window.setTimeout(timeout, Math.max(12_000, text.split(/\s+/).length * 1000));
        setSpeaking(true);
      };
      prompt.onend = () => complete(true);
      prompt.onerror = event => {
        if (utterance.current?.prompt !== prompt) return;
        const retry = !started && Boolean(prompt.voice) && !defaultVoice &&
          ['voice-unavailable', 'synthesis-failed', 'language-unavailable'].includes(event.error);
        complete(false, retry);
        if (!retry && event.error !== 'canceled' && event.error !== 'interrupted') {
          setPlaybackError('Question audio is unavailable. Select Play question to try again.');
        }
      };
      try {
        if (engine.paused) engine.resume();
        engine.speak(prompt);
      } catch {
        complete(false);
        setPlaybackError('Question audio is unavailable. Select Play question to try again.');
      }
      return done.promise;
    };
    return await play(false);
  }, [stopSpeaking]);

  return { canRecord, error, status, transcript, start, stop, speak, stopSpeaking, speaking, playbackError };
}
