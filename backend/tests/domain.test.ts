import { describe, it, expect } from 'vitest';
import type { Question, Turn } from '../../shared/contracts.ts';
import { questionPacing } from '../../shared/interview-pacing.ts';
import { loadConfig } from '../src/config.ts';
import { nextFocus, repeatsQuestion } from '../src/services/ai/coaching.ts';
import { extractSkills, localRoleAnalysis } from '../src/services/resumes.ts';
import { verifyFeedback, verifyQuote } from '../src/services/reports.ts';

describe('interview domain', () => {
  it('keeps easy sessions easy, progresses higher levels and caps secondary categories', () => {
    for (const difficulty of ['foundation', 'intermediate', 'advanced'] as const) {
      const settings = { track: 'frontend' as const, difficulty, minutes: 15 as const };
      const asked: Question[] = [];
      for (let index = 0; index < 40; index++) {
        const policy = questionPacing(settings, asked);
        const expected = difficulty === 'foundation' ? 'foundation' : difficulty === 'intermediate'
          ? index < 2 ? 'foundation' : 'intermediate' : index < 1 ? 'foundation' : index < 3 ? 'intermediate' : 'advanced';
        expect(policy.difficulty).toBe(expected);
        asked.push({ id: String(index), text: 'Question ' + index, topic: 'Topic', followUp: false, ...policy });
      }
      expect(asked.filter(question => question.category === 'resume')).toHaveLength(3);
      expect(asked.filter(question => question.category === 'behavioral')).toHaveLength(3);
      expect(asked.filter(question => question.category === 'track').length).toBeGreaterThan(30);
    }
  });
  it('rejects repeated questions even when punctuation changes', () => {
    expect(repeatsQuestion('How does a queue recover?', ['How does a queue recover!'])).toBe(true);
    expect(repeatsQuestion('When would you use tabs?', ['How does a queue recover!'])).toBe(false);
  });
  it('uses basic concepts for Easy questions and rotates away from asked topics', () => {
    const settings = { track: 'frontend' as const, difficulty: 'foundation' as const, minutes: 15 as const };
    const context = { title: 'Frontend Engineer', description: 'React role', resumeText: 'Resume content', skills: ['React'],
      topics: ['advanced rendering optimization'], projects: [], experience: [], resumeSummary: '' };
    const first = nextFocus(settings, context, [], 'track');
    expect(first).not.toBe('advanced rendering optimization');
    const second = nextFocus(settings, context, [{ id: 'one', text: 'Earlier question', topic: first, category: 'track', followUp: false }], 'track');
    expect(second).not.toBe(first);
  });

  it('recognizes literal technologies and separates preferred skills', () => {
    expect(extractSkills('C++, C#, JavaScript and React.')).toEqual(['JavaScript', 'React', 'C#', 'C++']);
    expect(localRoleAnalysis('Required: React and TypeScript. Preferred qualifications: Docker.')).toMatchObject({
      required: ['TypeScript', 'React'], preferred: ['Docker'],
    });
  });

  it('uses exact source offsets and requires an unambiguous repeated span', () => {
    expect(verifyQuote('Cache cache cache', 'cache', null)).toBeNull();
    expect(verifyQuote('Cache cache cache', 'cache', 6)).toEqual({ start: 6, end: 11, quote: 'cache' });
    expect(verifyQuote('use React', 'Use React', 0)).toBeNull();
    expect(verifyQuote('use React', 'React', 0)).toEqual({ start: 4, end: 9, quote: 'React' });
    expect(verifyQuote('Cache cache cache', 'cache', 0)).toBeNull();
    expect(verifyQuote('😀 React', 'React', 3)?.start).toBe(3);
  });

  it('rejects invalid scores or fabricated evidence', () => {
    const turn: Turn = {
      id: 'test-turn', question: { id: 'q', topic: 'Cache', text: 'What is caching?', followUp: false },
      answer: 'A cache can store repeated reads.', createdAt: '2026-11-17T00:00:00.000Z',
    };
    const grade = { dimension: 'accuracy', score: 3, quote: 'cache can store repeated reads',
      offset: null, rationale: 'Correctly describes caching repeated reads.' };
    expect(() => verifyFeedback(turn, { grades: [{ ...grade, score: 10 }], strengths: [], improvements: [] })).toThrow();
    expect(() => verifyFeedback(turn, { grades: [{ ...grade, quote: 'auth tokens' }], strengths: [], improvements: [] })).toThrow();
    const result = verifyFeedback(turn, {
      grades: [grade, { ...grade, dimension: 'reasoning', quote: 'invented evidence' }],
      strengths: ['Uses the word "invented".'], improvements: ['Explain how you would expire the entry.'],
    });
    expect(result.grades).toHaveLength(1);
    expect(result.grades[0]?.evidence.quote).toBe('cache can store repeated reads');
    expect(result.strengths).toEqual([]);
    expect(result.improvements).toHaveLength(1);
  });

  it('validates missing settings and prevents production memory mode', () => {
    expect(() => loadConfig({ DATA_STORE: 'memory' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', DATA_STORE: 'memory', JWT_SECRET: 's'.repeat(64) })).toThrow(/DATA_STORE/);
    expect(() => loadConfig({ DATA_STORE: 'memory', JWT_SECRET: 's'.repeat(64), AI_PROVIDER: 'gemini' })).toThrow(/GOOGLE_API_KEY/);
    const speech = { DATA_STORE: 'memory', JWT_SECRET: 's'.repeat(64), AUDIO_TRANSCRIPTION_PROVIDER: 'gemini',
      AUDIO_TRANSCRIPTION_MODEL: 'gemini-3.5-transcribe' };
    expect(() => loadConfig(speech)).toThrow(/GOOGLE_API_KEY/);
    expect(loadConfig({ ...speech, GOOGLE_API_KEY: 'test-key' }).AUDIO_TRANSCRIPTION_PROVIDER).toBe('gemini');
    expect(() => loadConfig({ ...speech, AUDIO_TRANSCRIPTION_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });
});
