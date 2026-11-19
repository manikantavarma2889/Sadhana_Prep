import { randomUUID } from 'node:crypto';
import {
  dimensions, type AnswerFeedback, type Evidence, type InterviewReport, type ReportStatus, type Turn,
} from '../../../shared/contracts.ts';
import type { Interview, Store } from '../db/store.ts';
import { draftSchema, type CoachingAI } from './ai/coaching.ts';
import { AppError } from '../errors.ts';

export const rubricVersion = 'forge-rubric-1';
const maxAttempts = 3;

export function verifyQuote(answer: string, quote: string, offset: number | null): Evidence | null {
  if (!quote.trim()) return null;
  let start = offset ?? answer.indexOf(quote);
  if (start < 0 || answer.slice(start, start + quote.length) !== quote) {
    start = answer.indexOf(quote);
    if (start < 0 || answer.indexOf(quote, start + 1) >= 0) return null;
  }
  if (offset === null && answer.indexOf(quote, start + 1) >= 0) return null;
  return { start, end: start + quote.length, quote: answer.slice(start, start + quote.length) };
}

function withoutQuotes(text: string) {
  return !/["“”`]|(?:^|\s)['‘][^'’\n]+['’](?:\s|[.,;!?]|$)/u.test(text);
}

export function verifyFeedback(turn: Turn, input: unknown): AnswerFeedback {
  const draft = draftSchema.parse(input);
  const grades: AnswerFeedback['grades'] = [];
  for (const grade of draft.grades) {
    if (!turn.answer || grades.some(current => current.dimension === grade.dimension)) continue;
    const evidence = verifyQuote(turn.answer, grade.quote, grade.offset);
    if (evidence && withoutQuotes(grade.rationale)) {
      grades.push({ dimension: grade.dimension, score: grade.score, evidence, rationale: grade.rationale });
    }
  }
  if (draft.grades.length && !grades.length) throw new Error('No provider evidence could be verified');
  return {
    turnId: turn.id, grades,
    strengths: grades.length ? draft.strengths.filter(withoutQuotes) : [],
    improvements: draft.improvements.filter(withoutQuotes),
  };
}

export function reportData(interview: Interview): InterviewReport {
  const rows = dimensions.map(([dimension]) => {
    const grades = interview.feedback.flatMap(item => item.grades.filter(grade => grade.dimension === dimension));
    const score = grades.length ? 25 * grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length : null;
    return { dimension, score, count: grades.length };
  });
  const assessed = rows.flatMap(row => row.score === null ? [] : [row.score]);
  return {
    status: interview.reportStatus, provider: interview.provider, rubric: interview.rubric,
    overall: assessed.length ? Math.round(assessed.reduce((sum, score) => sum + score, 0) / assessed.length) : null,
    dimensions: rows.map(row => ({ ...row, score: row.score === null ? null : Math.round(row.score) })),
    answers: interview.feedback,
    graded: interview.feedback.filter(item => item.grades.length > 0).length,
    attempted: interview.turns.filter(turn => turn.answer !== null).length,
    failed: interview.failedTurns.filter(item => item.attempts >= maxAttempts).length,
  };
}

export function reportWorker(store: Store, ai: CoachingAI, leaseMs: number) {
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const options = { sort: 'reportWake', ascending: true, limit: 1,
        before: { field: 'reportWake', value: now, inclusive: true } } as const;
      const where = { provider: ai.provider, model: ai.model };
      const [queued, expired] = await Promise.all([
        store.interviews.list({ ...where, reportStatus: 'queued' }, options),
        store.interviews.list({ ...where, reportStatus: 'working' }, options),
      ]);
      const job = expired[0] ?? queued[0];
      if (!job) return;
      const reportLease = randomUUID();
      const claimed = await store.interviews.update({
        id: job.id, reportStatus: job.reportStatus, reportWake: job.reportWake, reportLease: job.reportLease,
      }, { reportStatus: 'working', reportWake: now + leaseMs, reportLease });
      if (!claimed) return;
      const turn = claimed.turns.find(item => item.answer && !claimed.feedback.some(graded => graded.turnId === item.id)
        && !claimed.failedTurns.some(failed => failed.turnId === item.id && failed.attempts >= maxAttempts));
      if (!turn) {
        const reportStatus: ReportStatus = claimed.failedTurns.length ? (claimed.feedback.length ? 'partial' : 'failed') : 'ready';
        const { overall } = reportData(claimed);
        await store.interviews.update({ id: claimed.id, reportLease }, {
          reportStatus, reportWake: null, reportLease: null, score: overall,
        });
        return;
      }
      const failed = claimed.failedTurns.filter(item => item.turnId !== turn.id);
      try {
        const review = verifyFeedback(turn, await ai.evaluate(turn, turn.criterion, {
          ...claimed, difficulty: turn.question.difficulty ?? claimed.difficulty,
        }));
        await store.interviews.update({ id: claimed.id, reportLease }, {
          feedback: [...claimed.feedback, review], failedTurns: failed,
          reportStatus: 'queued', reportWake: Date.now(), reportLease: null,
        });
      } catch (error) {
        const attempts = (claimed.failedTurns.find(item => item.turnId === turn.id)?.attempts ?? 0) + 1;
        console.warn(JSON.stringify({ event: 'report_attempt_failed', interviewId: claimed.id, attempts,
          category: error instanceof Error ? error.name : 'UnknownError' }));
        await store.interviews.update({ id: claimed.id, reportLease }, {
          failedTurns: [...failed, { turnId: turn.id, attempts }], reportStatus: 'queued', reportLease: null,
          reportWake: Date.now() + (attempts >= maxAttempts ? 0 :
            error instanceof AppError && error.code === 'PROVIDER_RATE_LIMIT' ? error.retryAfterMs ?? 60000 : 750 * 2 ** attempts),
        });
      }
    } finally {
      running = false;
    }
  }
  return { tick };
}
