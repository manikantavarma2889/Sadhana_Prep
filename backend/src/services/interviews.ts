import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  difficulties, durations, tracks, type InterviewReport, type InterviewSession,
  type InterviewSummary, type Question, type Trends, type Turn,
} from '../../../shared/contracts.ts';
import { DuplicateRecord, type Interview, type PlanItem, type RecordedTurn, type Store } from '../db/store.ts';
import { openingQuestion, openingTopic } from '../../../shared/interview-opening.ts';
import { questionPacing } from '../../../shared/interview-pacing.ts';
import { AppError, conflict, missing } from '../errors.ts';
import { digest } from './auth.ts';
import { nextFocus, normalizeQuestion, repeatsQuestion, type CoachingAI } from './ai/coaching.ts';
import { listLibrary, resumeSignature } from './resumes.ts';
import { reportData, rubricVersion } from './reports.ts';

export const settingsSchema = z.object({
  track: z.enum(tracks), difficulty: z.enum(difficulties),
  minutes: z.literal(durations), analysisId: z.uuid(),
  practiceTrack: z.enum(tracks.filter(track => track !== 'practice')).optional(),
}).strict();
const revisionSchema = z.object({ questionId: z.uuid(), expectedRevision: z.number().int().nonnegative() });
export const answerSchema = z.discriminatedUnion('action', [
  revisionSchema.extend({ action: z.literal('answer'), text: z.string().trim().min(1).max(8000) }).strict(),
  revisionSchema.extend({ action: z.literal('skip') }).strict(),
]);
export const trendsSchema = z.object({ track: z.enum(tracks).default('mern'), difficulty: z.enum(difficulties).default('intermediate') });
export const cursorSchema = z.object({ cursor: z.string().regex(/^\d{4}-\d\d-\d\dT[\d:.]+Z_[a-f0-9-]{36}$/).optional() });
export const keySchema = z.string().regex(/^[a-zA-Z0-9_-]{12,100}$/);

function displayQuestion({ id, text, topic, followUp, category, difficulty }: Question): Question {
  return { id, text, topic, followUp, ...(category ? { category } : {}), ...(difficulty ? { difficulty } : {}) };
}

function displayTurn({ id, question, answer, createdAt }: Turn): Turn {
  return { id, question: displayQuestion(question), answer, createdAt };
}

function summary(interview: Interview): InterviewSummary {
  const { id, track, difficulty, minutes, role, status, startedAt, completedAt, reportStatus, score, provider } = interview;
  const covered = new Set(interview.turns.filter(turn => turn.answer !== null).map(turn => turn.planIndex)).size;
  return { id, track, difficulty, minutes, role, status, startedAt, completedAt, planned: interview.plan.length,
    covered, reportStatus, score, provider, ...(interview.timeBased ? { timeBased: true } : {}),
    ...(interview.practiceTrack ? { practiceTrack: interview.practiceTrack } : {}) };
}

function session(interview: Interview): InterviewSession {
  return {
    ...summary(interview), question: interview.question ? displayQuestion(interview.question) : null,
    deadlineAt: interview.deadlineAt, revision: interview.revision, turns: interview.turns.map(displayTurn),
  };
}

function completion(turns: RecordedTurn[], now: number): Partial<Interview> {
  const hasAnswers = turns.some(turn => turn.answer !== null);
  return {
    status: 'completed', completedAt: new Date(now).toISOString(), question: null,
    reportStatus: hasAnswers ? 'queued' : 'ready', reportWake: hasAnswers ? now : null,
  };
}

export function interviewService(store: Store, ai: CoachingAI, now = Date.now) {
  async function get(owner: string, id: string) {
    return await store.interviews.get({ owner, id }) ?? missing();
  }

  async function reconcile(interview: Interview): Promise<Interview> {
    if (interview.status === 'completed' || Date.parse(interview.deadlineAt) > now()) return interview;
    return await store.interviews.update({
      owner: interview.owner, id: interview.id, revision: interview.revision, status: 'active',
    }, { ...completion(interview.turns, now()), revision: interview.revision + 1 })
      ?? await get(interview.owner, interview.id);
  }

  function replayCreate(record: Interview, hash: string) {
    if (record.createHash !== hash) conflict('This creation key was used with different settings.');
    return session(record);
  }

  function replayAnswer(record: Interview, key: string, hash: string) {
    const prior = record.submissions.find(item => item.key === key);
    if (!prior) return null;
    if (prior.hash !== hash) conflict('This submission key was used for a different answer.');
    return session(record);
  }

  async function nextQuestion(owner: string, id: string): Promise<InterviewSession> {
    const record = await reconcile(await get(owner, id));
    if (!record.timeBased || record.status !== 'active' || record.question) return session(record);
    if (!record.context) throw new AppError(503, 'CONTEXT_UNAVAILABLE', 'Interview context could not be loaded.');
    if (record.provider !== ai.provider || record.model !== ai.model) {
      throw new AppError(503, 'PROVIDER_CHANGED', 'Restore this interview’s provider before continuing.');
    }
    const pacing = questionPacing(record, record.plan);
    const selected = await ai.nextQuestion({ settings: record, context: record.context, ...pacing,
      focusTopic: nextFocus({ ...record, difficulty: pacing.difficulty }, record.context, record.plan, pacing.category),
      remainingSeconds: Math.max(0, Math.floor((Date.parse(record.deadlineAt) - now()) / 1000)),
      covered: record.plan.map(question => question.text), previous: record.turns });
    if (record.plan.some(question => normalizeQuestion(question.text) === normalizeQuestion(selected.text)) ||
      repeatsQuestion(selected.text, record.plan.filter(question => question.topic.toLowerCase() === selected.topic.toLowerCase()).map(question => question.text))) {
      throw new AppError(503, 'REPEATED_QUESTION', 'The next question repeated an earlier prompt. Try again.');
    }
    const current = await reconcile(await get(owner, id));
    if (current.status !== 'active' || current.question) return session(current);
    const question: PlanItem = { ...selected, id: randomUUID(), followUp: false,
      category: pacing.category, difficulty: pacing.difficulty };
    const saved = await store.interviews.update({ owner, id, revision: record.revision, status: 'active' }, {
      question, plan: [...record.plan, question], planIndex: record.plan.length, revision: record.revision + 1,
    });
    return session(saved ?? await get(owner, id));
  }

  return {
    async list(owner: string, cursor?: string) {
      const page = await listLibrary(store.interviews, owner, cursor, item => item);
      return { items: (await Promise.all(page.items.map(reconcile))).map(summary), nextCursor: page.nextCursor };
    },
    async read(owner: string, id: string) { return session(await reconcile(await get(owner, id))); },
    async create(owner: string, input: z.infer<typeof settingsSchema>, key: string) {
      const hash = digest(JSON.stringify(input));
      const existing = await store.interviews.get({ owner, createKey: key });
      if (existing) return replayCreate(await reconcile(existing), hash);
      const analysis = await store.analyses.get({ owner, id: input.analysisId });
      if (!analysis) missing();
      const preparation = { track: input.track, difficulty: input.difficulty, minutes: input.minutes,
        ...(input.practiceTrack ? { practiceTrack: input.practiceTrack } : {}) };
      if (!analysis.preparation || !analysis.context || JSON.stringify(analysis.preparation) !== JSON.stringify(preparation)) {
        throw new AppError(409, 'ANALYSIS_REQUIRED', 'Analyze the complete setup before starting or changing interview settings.');
      }
      const resume = analysis.resumeId ? await store.resumes.get({ owner, id: analysis.resumeId }) : null;
      if (!resume || resumeSignature(resume) !== analysis.resumeSignature) {
        throw new AppError(409, 'RESUME_CHANGED', 'Select and analyze your current resume before starting.');
      }
      const role = analysis.title;
      const topics = analysis.topics;
      const opener: PlanItem = {
        topic: openingTopic, text: openingQuestion(role),
        criterion: 'Introduces relevant experience and explains specific motivation for the target role.',
        id: randomUUID(), followUp: false, category: 'introduction', difficulty: 'foundation',
      };
      const plan = [opener];
      const id = randomUUID();
      const start = now();
      const startedAt = new Date(start).toISOString();
      try {
        return session(await store.interviews.insert({
          ...input, id, owner, createKey: key, createHash: hash, sortKey: startedAt + '_' + id,
          status: 'active', plan, question: opener, planIndex: 0, revision: 0, role, topics,
          deadlineAt: new Date(start + input.minutes * 60_000).toISOString(), startedAt, completedAt: null,
          turns: [], submissions: [], feedback: [], failedTurns: [], reportStatus: 'unavailable', reportWake: null,
          reportLease: null, score: null, provider: ai.provider, model: ai.model, rubric: rubricVersion,
          timeBased: true, context: analysis.context,
        }));
      } catch (error) {
        if (!(error instanceof DuplicateRecord)) throw error;
        const committed = await store.interviews.get({ owner, createKey: key });
        if (!committed) throw error;
        return replayCreate(committed, hash);
      }
    },
    async answer(owner: string, id: string, input: z.infer<typeof answerSchema>, key: string) {
      const hash = digest(JSON.stringify(input));
      const interview = await reconcile(await get(owner, id));
      const replay = replayAnswer(interview, key, hash);
      if (replay) return replay;
      if (interview.status !== 'active' || !interview.question) conflict('This interview has already ended.');
      if (interview.revision !== input.expectedRevision || interview.question.id !== input.questionId) {
        conflict('The interview moved forward in another request. Refresh the current question.');
      }
      const current = interview.question;
      const answer = input.action === 'answer' ? input.text : null;
      if (interview.timeBased) {
        const timestamp = now();
        const turns = [...interview.turns, {
          id: randomUUID(), question: displayQuestion(current), answer, createdAt: new Date(timestamp).toISOString(),
          criterion: current.criterion, planIndex: interview.planIndex,
        }];
        const revision = interview.revision + 1;
        const saved = await store.interviews.update({ owner, id, revision: interview.revision, status: 'active' }, {
          revision, turns, question: null, submissions: [...interview.submissions, { key, hash, revision }],
          ...(timestamp >= Date.parse(interview.deadlineAt) ? completion(turns, timestamp) : {}),
        });
        if (!saved) return replayAnswer(await get(owner, id), key, hash) ?? conflict('The interview changed. Refresh before submitting another answer.');
        try { return await nextQuestion(owner, id); }
        catch (error) {
          if (!(error instanceof AppError) || error.status !== 503) throw error;
          return session(await reconcile(await get(owner, id)));
        }
      }
      let followUp: PlanItem | null = null;
      if (answer && !current.followUp && current.topic !== openingTopic && ai.provider === interview.provider && ai.model === interview.model) {
        const covered = [...interview.plan, ...interview.turns.map(turn => turn.question)].map(question => question.text);
        try {
          const selected = await ai.followUp(current, interview.turns, answer, covered);
          if (selected && !repeatsQuestion(selected.text, covered)) {
            followUp = { ...selected, id: randomUUID(), followUp: true };
          }
        } catch (error) {
          if (!(error instanceof AppError) || error.status !== 503) throw error;
        }
      }
      const timestamp = now();
      if (timestamp >= Date.parse(interview.deadlineAt)) {
        await reconcile(interview);
        conflict('The interview time limit has passed.');
      }
      const planIndex = followUp ? interview.planIndex : interview.planIndex + 1;
      const question = followUp ?? interview.plan[planIndex] ?? null;
      const turns = [...interview.turns, {
        id: randomUUID(), question: displayQuestion(current), answer, createdAt: new Date(timestamp).toISOString(),
        criterion: current.criterion, planIndex: interview.planIndex,
      }];
      const revision = interview.revision + 1;
      const committed = await store.interviews.update({
        owner, id, revision: interview.revision, status: 'active',
      }, {
        revision, question, planIndex, turns, submissions: [...interview.submissions, { key, hash, revision }],
        ...(question ? {} : completion(turns, timestamp)),
      });
      if (committed) return session(committed);
      const duplicate = replayAnswer(await get(owner, id), key, hash);
      return duplicate ?? conflict('The interview changed. Refresh before submitting another answer.');
    },
    nextQuestion,
    async finish(owner: string, id: string): Promise<InterviewSession> {
      for (let attempt = 0; attempt < 3; attempt++) {
        const interview = await get(owner, id);
        if (interview.status === 'completed') return session(interview);
        const committed = await store.interviews.update({ owner, id, revision: interview.revision, status: 'active' }, {
          ...completion(interview.turns, now()), revision: interview.revision + 1,
        });
        if (committed) return session(committed);
      }
      return conflict('The interview changed while finishing. Try again.');
    },
    async report(owner: string, id: string): Promise<InterviewReport> {
      return reportData(await reconcile(await get(owner, id)));
    },
    async retry(owner: string, id: string) {
      const interview = await get(owner, id);
      if (interview.reportStatus !== 'partial' && interview.reportStatus !== 'failed') return reportData(interview);
      if (ai.provider !== interview.provider || ai.model !== interview.model) {
        throw new AppError(503, 'PROVIDER_CHANGED', 'Restore the original interview provider and model to retry this report.');
      }
      const committed = await store.interviews.update({ owner, id, reportStatus: interview.reportStatus }, {
        failedTurns: [], reportStatus: 'queued', reportWake: now(), reportLease: null,
      });
      return reportData(committed ?? await get(owner, id));
    },
    async remove(owner: string, id: string) {
      if (!await store.interviews.remove({ owner, id })) missing();
    },
    async trends(owner: string, input: z.infer<typeof trendsSchema>): Promise<Trends> {
      const matches = await store.interviews.list({
        owner, ...input, provider: ai.provider, model: ai.model, rubric: rubricVersion, reportStatus: 'ready',
      }, { sort: 'sortKey', limit: 50 });
      const points = matches.filter(item => item.score !== null && item.completedAt)
        .slice(0, 20).reverse().map(item => ({
          id: item.id, date: item.completedAt!, score: item.score!, coverage: summary(item).covered / item.plan.length,
        }));
      return { ...input, provider: ai.provider, rubric: rubricVersion, points };
    },
  };
}
