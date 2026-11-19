import modelUrl from '../../assets/speech/vosk-model-small-en-us-0.15.tar.gz?url';
import type { Model } from 'vosk-browser';

let captionModel: Promise<Model> | undefined;

export function prepareCaptions(): Promise<Model> {
  captionModel ??= (async () => {
    const { Model } = await import('vosk-browser');
    const model = new Model(modelUrl, -1);
    return await new Promise<Model>((resolve, reject) => {
      const failed = () => {
        window.clearTimeout(timer);
        model.terminate();
        reject(new Error('Caption model could not load.'));
      };
      const timer = window.setTimeout(failed, 60_000);
      model.on('load', message => {
        if (!('result' in message) || !message.result) { failed(); return; }
        window.clearTimeout(timer);
        resolve(model);
      });
      model.on('error', failed);
    });
  })().catch(error => {
    captionModel = undefined;
    throw error;
  });
  return captionModel;
}

export async function startCaptions(
  stream: MediaStream,
  update: (text: string) => void,
  fail: () => void,
) {
  const model = await prepareCaptions();
  const context = new AudioContext();
  try { await context.resume(); } catch (error) { await context.close(); throw error; }
  const recognizer = new model.KaldiRecognizer(context.sampleRate);
  const source = context.createMediaStreamSource(stream);
  // Vosk consumes mono PCM in its worker. The output stays silent.
  const processor = context.createScriptProcessor(4096, 1, 1);
  let completed = '';
  let text = '';
  let closed = false;
  let finish: (() => void) | undefined;
  const publish = (partial = '') => {
    text = [completed, partial.trim()].filter(Boolean).join(' ').slice(0, 8000);
    update(text);
  };
  recognizer.on('result', message => {
    if (closed || !('result' in message) || !('text' in message.result)) return;
    const words = message.result.text.trim();
    if (words) {
      completed = [completed, words].filter(Boolean).join(' ').slice(0, 8000);
      publish();
    }
    if ('final' in message && message.final === true) finish?.();
  });
  recognizer.on('partialresult', message => {
    if (!closed && 'result' in message && 'partial' in message.result) publish(message.result.partial);
  });
  recognizer.on('error', () => { if (!closed) fail(); finish?.(); });
  processor.onaudioprocess = event => {
    if (!closed) recognizer.acceptWaveform(event.inputBuffer);
  };
  source.connect(processor);
  processor.connect(context.destination);

  function close() {
    if (closed) return;
    closed = true;
    processor.onaudioprocess = null;
    source.disconnect();
    processor.disconnect();
    recognizer.remove();
    void context.close();
    finish?.();
  }

  return {
    cancel: close,
    async stop() {
      if (closed) return text;
      source.disconnect();
      processor.disconnect();
      processor.onaudioprocess = null;
      let timer: number | undefined;
      try {
        await new Promise<void>(resolve => {
          finish = resolve;
          timer = window.setTimeout(resolve, 2500);
          recognizer.retrieveFinalResult();
        });
        return text;
      } finally {
        window.clearTimeout(timer);
        close();
      }
    },
  };
}
