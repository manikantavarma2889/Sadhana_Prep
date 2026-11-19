import type { DesignLesson } from './system-design-course.ts';

export const learningTracks = {
  dsa: { title: 'DSA Study Sheet', description: 'Recognize problem-solving patterns and work through a curated coding sheet.' },
  'system-design': { title: 'System Design', description: 'Follow the path of a request, study architecture trade-offs, and practice design cases.' },
  dbms: { title: 'Database Management', description: 'Review schema design, SQL, indexes, transactions, and query execution.' },
  os: { title: 'Operating Systems', description: 'Learn how processes, memory, scheduling, and files work together.' },
  networking: { title: 'Computer Networks', description: 'Trace packets through DNS, transport, HTTPS, and the infrastructure behind a request.' },
} as const;

export type LearningTrack = keyof typeof learningTracks;
export type LearningLevel = 'Foundations' | 'Intermediate' | 'Advanced';

export type LearningEntry = {
  id: string;
  title: string;
  topic: string;
  summary: string;
  level: LearningLevel;
  module?: { number: string; color: string };
};

export type LearningDetail = LearningEntry & {
  notes: { title: string; text: string }[];
  course?: DesignLesson;
};

export type LearningView = {
  id: string;
  title: string;
  description: string;
  layout: 'map' | 'sheet' | 'course' | 'cards';
  entries: LearningEntry[];
};

export function isLearningTrack(value: string | undefined): value is LearningTrack {
  return value !== undefined && Object.hasOwn(learningTracks, value);
}

