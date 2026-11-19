import { queryOptions } from '@tanstack/react-query';
import { learningTracks, type LearningTrack, type LearningView } from '../../../shared/learning.ts';
import { api } from '../services/api.ts';

export const prepHubPath = '/prep-hub';
export const learningTrackIds = Object.keys(learningTracks) as LearningTrack[];

export function learningOutlineOptions(track: LearningTrack) {
  return queryOptions({
    queryKey: ['learning-outline', track],
    queryFn: async () => {
      const outline = api<LearningView[]>('/learning/' + track, { auth: false });
      if (track !== 'dsa') return outline;
      const [views, { withDsaSheet }] = await Promise.all([outline, import('./dsa-sheet.ts')]);
      return withDsaSheet(views);
    },
    staleTime: 5 * 60_000,
  });
}

export function learningProgressKey(userId: string, track: LearningTrack) {
  return 'sadhana-learning-v1:' + userId + ':' + track;
}

export function readStoredIds(key: string | undefined): string[] | undefined {
  if (!key) return undefined;
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return undefined;
  }
}
