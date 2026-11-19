export const tracks = ['frontend', 'backend', 'mern', 'javascript', 'system-design', 'behavioral'] as const;
export const difficulties = ['foundation', 'intermediate', 'advanced'] as const;
export const durations = [10, 20, 30, 45] as const;
export const interviewQuestionCounts: Record<typeof durations[number], number> = { 10: 3, 20: 4, 30: 5, 45: 6 };
export const dimensions = [
  ['accuracy', 'Technical accuracy'],
  ['understanding', 'Conceptual understanding'],
  ['problemSolving', 'Problem solving'],
  ['clarity', 'Communication clarity'],
  ['completeness', 'Completeness'],
  ['reasoning', 'Reasoning'],
  ['relevance', 'Relevance'],
] as const;

export const trackLabels: Record<Track, string> = {
  frontend: 'Frontend', backend: 'Backend', mern: 'MERN stack',
  javascript: 'JavaScript / TypeScript', 'system-design': 'System design',
  behavioral: 'Behavioral',
};

export type Track = typeof tracks[number];
export type Difficulty = typeof difficulties[number];
export type Duration = typeof durations[number];
export type Dimension = typeof dimensions[number][0];
export type Provider = 'local' | 'openai' | 'gemini' | 'ollama';
export type ReportStatus = 'unavailable' | 'queued' | 'working' | 'ready' | 'partial' | 'failed';
export type Status = 'active' | 'completed';
export type User = { id: string; name: string; email: string; role: 'candidate'; voiceEnabled: boolean; passwordEnabled?: boolean };
export type Resume = { id: string; label: string; skills: string[]; createdAt: string };
export type RoleAnalysis = {
  id: string; title: string; resumeId: string | null; required: string[]; preferred: string[];
  matches: string[]; gaps: string[]; topics: string[]; createdAt: string;
};
export type InterviewSettings = { track: Track; difficulty: Difficulty; minutes: Duration; analysisId?: string };
export type Question = { id: string; text: string; topic: string; followUp: boolean };
export type Turn = { id: string; question: Question; answer: string | null; createdAt: string };
export type InterviewSummary = {
  id: string; track: Track; difficulty: Difficulty; minutes: Duration; role: string | null;
  status: Status; startedAt: string; completedAt: string | null; planned: number; covered: number;
  reportStatus: ReportStatus; score: number | null; provider: Provider;
};
export type InterviewSession = InterviewSummary & {
  question: Question | null; deadlineAt: string; revision: number; turns: Turn[];
};
export type Evidence = { start: number; end: number; quote: string };
export type Grade = { dimension: Dimension; score: number; evidence: Evidence; rationale: string };
export type AnswerFeedback = {
  turnId: string; grades: Grade[]; strengths: string[]; improvements: string[];
};
export type InterviewReport = {
  status: ReportStatus; provider: Provider; rubric: string; overall: number | null;
  dimensions: { dimension: Dimension; score: number | null; count: number }[];
  answers: AnswerFeedback[]; graded: number; attempted: number; failed: number;
};
export type Trends = {
  track: Track; difficulty: Difficulty; provider: Provider; rubric: string;
  points: { id: string; date: string; score: number; coverage: number }[];
};
export type List<T> = { items: T[]; nextCursor: string | null };
export type ApiErrorBody = { error: { code: string; message: string; requestId: string } };
