import { z } from 'zod';
import type { Config } from '../config.ts';
import { AppError } from '../errors.ts';

export const answerAudioTypes: Readonly<Record<string, string>> = {
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a',
  'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3',
};

export function createTranscriber(config: Config, providerFetch: typeof fetch = fetch) {
  const { AUDIO_TRANSCRIPTION_MODEL: model, OPENAI_API_KEY: key } = config;
  if (!model || !key) return undefined;
  return async function transcribe(file: Express.Multer.File, context = '') {
    const extension = Object.hasOwn(answerAudioTypes, file.mimetype) ? answerAudioTypes[file.mimetype] : undefined;
    if (!extension || !file.size) throw new AppError(415, 'INVALID_AUDIO', 'Choose a supported recording.');
    const body = new FormData();
    body.set('model', model);
    body.set('prompt', ('Interview vocabulary includes MongoDB, Node.js, Express, React, JavaScript, TypeScript, SQL. ' + context).slice(0, 1000));
    body.set('file', new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), 'answer.' + extension);
    const unavailable = new AppError(503, 'TRANSCRIPTION_UNAVAILABLE', 'Recording transcription is temporarily unavailable.');
    let result;
    try {
      const response = await providerFetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key }, body, signal: AbortSignal.timeout(35_000), redirect: 'error',
      });
      if (!response.ok) throw unavailable;
      result = z.object({ text: z.string() }).safeParse(await response.json());
    } catch { throw unavailable; }
    if (!result.success) throw unavailable;
    return { text: result.data.text.trim().slice(0, 8000) };
  };
}
