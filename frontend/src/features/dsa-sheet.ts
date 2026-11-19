import type { LearningLevel, LearningView } from '../../../shared/learning.ts';
import { earlierProblems, globalCompanies, indianCompanies, referenceProblems } from './dsa-sheet-content.ts';
import type { DsaDifficulty, DsaSheetEntry } from './dsa-sheet-types.ts';

const levels: Record<DsaDifficulty, LearningLevel> = { Easy: 'Foundations', Medium: 'Intermediate', Hard: 'Advanced' };
const difficultyByLevel: Record<LearningLevel, DsaDifficulty> = { Foundations: 'Easy', Intermediate: 'Medium', Advanced: 'Hard' };

// Keep bookmarks, completions and existing deep links for equivalent entries.
const existingIds: Record<string, string> = {
  'two-sum': 'pair-target', 'search-in-rotated-sorted-array': 'rotated-search', 'reverse-linked-list': 'reverse-list',
  'binary-tree-level-order-traversal': 'level-order', 'number-of-islands': 'island-counter', subsets: 'subsets',
  'longest-substring-without-repeating-characters': 'window-distinct', 'valid-parentheses': 'balanced-delimiters',
  'merge-intervals': 'merge-intervals', 'climbing-stairs': 'step-count', 'coin-change': 'coin-change',
  'trapping-rain-water': 'trapped-water', 'merge-k-sorted-lists': 'merge-streams', 'top-k-frequent-elements': 'top-frequent',
  'course-schedule': 'course-order', 'validate-binary-search-tree': 'validate-tree', 'daily-temperatures': 'next-warmer',
  'product-of-array-except-self': 'product-except', 'group-anagrams': 'group-anagrams', 'word-search': 'board-word',
  'subarray-sum-equals-k': 'target-ranges', 'linked-list-cycle-ii': 'cycle-entry',
  'count-number-subarrays-given-xor': 'sheet-subarray-with-given-xor',
};

const catalogue = [...referenceProblems, ...earlierProblems];
export const referenceProblemCount = referenceProblems.length;

export function withDsaSheet(views: LearningView[]): LearningView[] {
  return views.map(view => {
    if (view.id !== 'sheet') return view;
    const original = new Map(view.entries.map(entry => [entry.id, entry]));
    const entries: DsaSheetEntry[] = catalogue.map(([title, difficulty, topic, companies, slug, frequency, gfgOnly], index) => {
      const id = existingIds[slug] ?? 'sheet-' + slug;
      return {
        id, title, topic, level: levels[difficulty],
        summary: original.get(id)?.summary ?? 'Practice ' + topic.toLowerCase() + ' with this ' + difficulty.toLowerCase() + ' problem.',
        problem: { order: index + 1, difficulty, companies, slug, frequency, gfgOnly, original: original.has(id) },
      };
    });
    const included = new Set(entries.map(entry => entry.id));
    const supplements: DsaSheetEntry[] = view.entries.filter(entry => !included.has(entry.id)).map((entry, index) => ({
      ...entry, problem: { order: entries.length + index + 1, difficulty: difficultyByLevel[entry.level], companies: [], original: true },
    }));
    return { ...view, entries: [...entries, ...supplements] };
  });
}

const suppliedNames = new Set([...globalCompanies, ...indianCompanies]);
const extraNames = catalogue.flatMap(entry => entry[3]).filter(company => !suppliedNames.has(company));
export const sheetCompanies = { global: [...globalCompanies, ...new Set(extraNames)], indian: indianCompanies };

export function problemResources({ title, problem: { slug, gfgOnly } }: DsaSheetEntry) {
  const query = encodeURIComponent(title);
  return {
    leetCode: slug && (gfgOnly ? 'https://leetcode.com/problemset/?search=' + query : 'https://leetcode.com/problems/' + slug + '/'),
    geeksForGeeks: 'https://www.geeksforgeeks.org/?s=' + query,
    video: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(title + ' leetcode geeksforgeeks solution'),
  };
}
