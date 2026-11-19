import { isLearningTrack, type LearningDetail, type LearningTrack, type LearningView } from '../../../../shared/learning.ts';
import { missing } from '../../errors.ts';
import { patterns, problems } from './dsa.ts';
import { databaseLessons, networkingLessons, operatingSystemsLessons } from './fundamentals.ts';
import { designCases, designLessons } from './system-design.ts';

type CatalogView = Omit<LearningView, 'entries'> & { entries: LearningDetail[] };
const catalog: Record<LearningTrack, CatalogView[]> = {
  dsa: [
    { id: 'patterns', title: 'DSA pattern breakdown', description: 'Follow a branch to learn when to use a pattern and how to recognize it in a problem.', layout: 'map', entries: patterns },
    { id: 'sheet', title: 'DSA sheet', description: 'Search by topic or difficulty, open a problem, and mark it complete as you work through the sheet.', layout: 'sheet', entries: problems },
  ],
  'system-design': [
    { id: 'learn', title: 'Learn', description: 'Work through architecture concepts one diagram step at a time.', layout: 'course', entries: designLessons },
    { id: 'practice', title: 'Practice', description: 'Work through open-ended design cases with requirements, an approach, and trade-offs to discuss.', layout: 'cards', entries: designCases },
  ],
  dbms: [{ id: 'learn', title: 'DBMS lessons', description: 'Review relational concepts and answer a short interview check for each topic.', layout: 'cards', entries: databaseLessons }],
  os: [{ id: 'learn', title: 'OS lessons', description: 'Review how a machine runs programs and manages shared resources.', layout: 'cards', entries: operatingSystemsLessons }],
  networking: [{ id: 'learn', title: 'Networking lessons', description: 'Follow data across layers and practice explaining what happens along the way.', layout: 'cards', entries: networkingLessons }],
};

function trackViews(track: unknown): CatalogView[] {
  if (typeof track !== 'string' || !isLearningTrack(track)) return missing();
  return catalog[track];
}

export function learningOutline(track: unknown): LearningView[] {
  return trackViews(track).map(view => ({
    ...view, entries: view.entries.map(({ id, title, topic, summary, level, module }) => ({ id, title, topic, summary, level, module })),
  }));
}

export function learningDetail(track: string, item: string): LearningDetail {
  const entry = trackViews(track).flatMap(view => view.entries).find(candidate => candidate.id === item);
  return entry ?? missing();
}
