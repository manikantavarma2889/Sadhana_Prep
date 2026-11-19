import type { Difficulty, InterviewSettings, Question, QuestionCategory } from './contracts.ts';

export function questionPacing(settings: InterviewSettings, asked: Question[]) {
  const substantive = asked.filter(question => question.category !== 'introduction');
  const count = substantive.length;
  const cycle: QuestionCategory[] = ['track', 'track', 'resume', 'track', 'behavioral'];
  let category = cycle[count % cycle.length]!;
  const sideLimit = settings.minutes >= 30 ? 4 : 3;
  if (category !== 'track' && substantive.filter(question => question.category === category).length >= sideLimit) category = 'track';
  let difficulty: Difficulty = 'foundation';
  if (settings.difficulty === 'intermediate') difficulty = count < 2 ? 'foundation' : 'intermediate';
  if (settings.difficulty === 'advanced') {
    const easy = settings.minutes >= 30 ? 2 : 1;
    difficulty = count < easy ? 'foundation' : count < easy + 2 ? 'intermediate' : 'advanced';
  }
  return { category, difficulty, index: count };
}
