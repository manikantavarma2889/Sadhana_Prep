import { z } from 'zod';
import type { Config } from '../config.ts';
import { AppError } from '../errors.ts';

export const answerAudioTypes: Readonly<Record<string, string>> = {
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a',
  'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3',
};

const technicalVocabulary = ['MongoDB', 'Node.js', 'Express', 'React', 'JavaScript', 'TypeScript', 'SQL',
  'MERN', 'DBMS', 'REST', 'GraphQL', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'LangChain'];
const geminiTranscript = z.object({
  status: z.literal('completed'),
  steps: z.array(z.object({
    type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

export function createTranscriber(config: Config, providerFetch: typeof fetch = fetch) {
  const { AUDIO_TRANSCRIPTION_MODEL: model, AUDIO_TRANSCRIPTION_PROVIDER: provider } = config;
  const key = provider === 'gemini' ? config.GOOGLE_API_KEY : config.OPENAI_API_KEY;
  if (!model || !key) return undefined;
  return async function transcribe(file: Express.Multer.File, context = '', vocabulary: string[] = []) {
    const extension = Object.hasOwn(answerAudioTypes, file.mimetype) ? answerAudioTypes[file.mimetype] : undefined;
    if (!extension || !file.size) throw new AppError(415, 'INVALID_AUDIO', 'Choose a supported recording.');
    const unavailable = new AppError(503, 'TRANSCRIPTION_UNAVAILABLE', 'Recording transcription is temporarily unavailable.');
    try {
      if (provider === 'gemini') {
        const terms = [...new Set([...technicalVocabulary, ...vocabulary.map(term => term.trim().slice(0, 120)).filter(Boolean)])].slice(0, 100);
        const response = await providerFetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(35_000),
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
          body: JSON.stringify({
            model, store: false,
            input: [{ type: 'audio', data: file.buffer.toString('base64'),
              mime_type: file.mimetype === 'video/webm' ? 'audio/webm' : file.mimetype }],
            generation_config: { transcription_config: {
              language_codes: ['en'], custom_vocabulary: terms, mode: { type: 'verbatim' },
            } },
          }),
        });
        if (!response.ok) throw unavailable;
        const result = geminiTranscript.parse(await response.json());
        const text = result.steps.filter(step => step.type === 'model_output')
          .flatMap(step => step.content ?? []).flatMap(part => part.type === 'text' && part.text !== undefined ? [part.text] : []);
        if (!text.length) throw unavailable;
        return { text: text.join('\n').trim().slice(0, 8000) };
      }
      const body = new FormData();
      body.set('model', model);
      body.set('prompt', ('Interview vocabulary includes ' + technicalVocabulary.join(', ') + '. ' + context).slice(0, 1000));
      body.set('file', new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), 'answer.' + extension);
      const response = await providerFetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key }, body, signal: AbortSignal.timeout(35_000), redirect: 'error',
      });
      if (!response.ok) throw unavailable;
      const result = z.object({ text: z.string() }).parse(await response.json());
      return { text: result.text.trim().slice(0, 8000) };
    } catch { throw unavailable; }
  };
}
