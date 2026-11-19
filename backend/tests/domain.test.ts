import { describe, it, expect } from 'vitest';
import type { Turn } from '../../shared/contracts.ts';
import { loadConfig } from '../src/config.ts';
import { repeatsQuestion } from '../src/services/ai/coaching.ts';
import { extractSkills, localRoleAnalysis } from '../src/services/resumes.ts';
import { verifyFeedback, verifyQuote } from '../src/services/reports.ts';

describe('interview domain', () => {
  it('rejects repeated questions even when punctuation changes', () => {
    expect(repeatsQuestion('How does a queue recover?', ['How does a queue recover!'])).toBe(true);
    expect(repeatsQuestion('When would you use tabs?', ['How does a queue recover!'])).toBe(false);
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
  });
});
