import type { LearningEntry } from '../../../shared/learning.ts';

export type DsaDifficulty = 'Easy' | 'Medium' | 'Hard';
export type DsaPanel = 'description' | 'approach' | 'companies' | 'resources';
export type DsaReferenceDetail = { description: string; example: string; approach: string; code: string; complexity: string };
export type DsaSheetEntry = LearningEntry & {
  problem: { order: number; difficulty: DsaDifficulty; companies: string[]; slug?: string; frequency?: number; gfgOnly?: boolean; original?: boolean };
};

export function isDsaSheetEntry(entry: LearningEntry): entry is DsaSheetEntry {
  return 'problem' in entry;
}
