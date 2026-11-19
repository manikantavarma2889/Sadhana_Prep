import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, Check, Pin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isLearningTrack, learningTracks, type LearningTrack } from '../../../shared/learning.ts';
import { learningOutlineOptions, learningProgressKey, learningTrackIds, prepHubPath, readStoredIds } from '../features/learning-tracks.ts';
import { ErrorNotice, Loading } from './ui.tsx';

export function PinnedSubjects({ userId }: { userId: string }) {
  const storageKey = 'sadhana-dashboard-pins-v1:' + userId;
  const [pins, setPins] = useState(() => readStoredIds(storageKey)?.filter(isLearningTrack) ?? []);

  function toggle(track: LearningTrack) {
    const saved = readStoredIds(storageKey)?.filter(isLearningTrack) ?? pins;
    const next = pins.includes(track) ? saved.filter(id => id !== track) : [...new Set([...saved, track])];
    setPins(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the selection for this visit if storage is unavailable. */ }
  }

  return <section aria-labelledby="pinned-subjects-title">
    <div className="overview-section-heading"><h2 id="pinned-subjects-title"><Pin size={17} aria-hidden />Pinned subjects</h2></div>
    <div className="overview-pins">
      <details className="overview-pin-picker">
        <summary><Plus size={18} aria-hidden />Pin a subject</summary>
        <div className="overview-pin-options" role="group" aria-label="Choose pinned subjects">
          {learningTrackIds.map(track => <button type="button" key={track} aria-pressed={pins.includes(track)} onClick={() => toggle(track)}>
            {learningTracks[track].title}{pins.includes(track) && <Check size={15} aria-hidden />}
          </button>)}
        </div>
      </details>
      {pins.map(track => <Link className="overview-pinned-link" key={track} to={prepHubPath + '/' + track}>
        <Pin size={15} aria-hidden />{learningTracks[track].title}<ArrowRight size={14} aria-hidden />
      </Link>)}
    </div>
  </section>;
}

export function PrepHubProgress({ userId }: { userId: string }) {
  const outlines = useQueries({ queries: learningTrackIds.map(learningOutlineOptions) });
  const progress = learningTrackIds.map((track, index) => {
    const views = outlines[index]?.data;
    const entries = new Set(views?.flatMap(view => view.entries.map(entry => entry.id)));
    const completed = new Set(readStoredIds(learningProgressKey(userId, track)));
    return { track, ready: views !== undefined, done: [...entries].filter(id => completed.has(id)).length, total: entries.size };
  });
  const ready = progress.every(item => item.ready);
  const done = progress.reduce((sum, item) => sum + item.done, 0);
  const total = progress.reduce((sum, item) => sum + item.total, 0);
  const failure = outlines.find(outline => outline.isError && !outline.data)?.error;

  return <section className="panel overview-progress-card" aria-labelledby="prep-progress-title">
    <div className="overview-progress-heading"><h2 id="prep-progress-title">Prep Hub Progress</h2>
      <Link to={prepHubPath} className="overview-progress-link" aria-label="Open Prep Hub"><ArrowRight size={16} aria-hidden /></Link>
    </div>
    {ready ? <div className="overview-prep-total">
      <div><span>Items completed</span><strong>{done} / {total}</strong></div>
      <progress aria-label="Prep Hub completion" value={done} max={Math.max(total, 1)} />
    </div> : failure ? <ErrorNotice error={failure} retry={() => { void Promise.all(outlines.filter(outline => outline.isError).map(outline => outline.refetch())); }} />
      : <Loading label="Loading learning progress…" />}
    <ul className="overview-prep-tracks">
      {progress.map(({ track, ready, done, total }) => <li key={track}>
        <div><Link to={prepHubPath + '/' + track}>{learningTracks[track].title}</Link><span>{ready ? done + ' / ' + total : '—'}</span></div>
        {ready && <progress aria-label={learningTracks[track].title + ' completion'} value={done} max={Math.max(total, 1)} />}
      </li>)}
    </ul>
  </section>;
}

