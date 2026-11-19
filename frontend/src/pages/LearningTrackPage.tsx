import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Circle, Code2, LockKeyhole } from 'lucide-react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { isLearningTrack, learningTracks, type LearningDetail, type LearningEntry, type LearningTrack, type LearningView } from '../../../shared/learning.ts';
import { LearningDialog } from '../components/LearningDialog.tsx';
import { SiteNav } from '../components/SiteNav.tsx';
import { ErrorNotice, Loading } from '../components/ui.tsx';
import { isDsaSheetEntry, type DsaPanel } from '../features/dsa-sheet-types.ts';
import { learningOutlineOptions, learningProgressKey, prepHubPath, readStoredIds } from '../features/learning-tracks.ts';
import { api, queryString } from '../services/api.ts';
import { useSession } from '../services/session.tsx';
import './learning.css';

const previewCount = 6;
const SystemDesignCourse = lazy(() => import('../components/SystemDesignCourse.tsx').then(module => ({ default: module.SystemDesignCourse })));
const DsaPracticeSheet = lazy(() => import('../components/DsaPracticeSheet.tsx').then(module => ({ default: module.DsaPracticeSheet })));

function learningPath(track: LearningTrack, view: string, item?: string, panel?: DsaPanel) {
  return prepHubPath + '/' + track + queryString({ view, item, panel: panel === 'description' ? undefined : panel });
}

function PreviewBoundary({ total, onOpen }: { total: number; onOpen: () => void }) {
  const boundary = useRef<HTMLDivElement>(null);
  const prompted = useRef(false);
  useEffect(() => {
    function checkBoundary() {
      const top = boundary.current?.getBoundingClientRect().top;
      if (prompted.current || top === undefined || window.scrollY === 0 || top > window.innerHeight - 40 || top < 0) return;
      prompted.current = true;
      onOpen();
    }
    window.addEventListener('scroll', checkBoundary, { passive: true });
    return () => window.removeEventListener('scroll', checkBoundary);
  }, [onOpen]);

  return <div className="learning-boundary" ref={boundary}>
    <span className="learning-lock"><LockKeyhole size={21} aria-hidden /></span>
    <div><h3>Continue with a free account</h3><p>Sign in to open these items and see all {total} in this section.</p></div>
    <button className="button button-primary" onClick={() => { prompted.current = true; onOpen(); }}>Sign in to continue</button>
  </div>;
}

function ProgressSummary({ title, complete, total }: { title: string; complete: number; total: number }) {
  return <div className="learning-progress">
    <div><span>{title}</span><strong>{complete} / {total}</strong></div>
    <progress aria-label={title} value={complete} max={total} />
  </div>;
}

function EntryState({ locked, done }: { locked: boolean; done: boolean }) {
  if (locked) return <LockKeyhole size={16} aria-label="Sign-in required" />;
  if (done) return <Check size={17} aria-label="Complete" />;
  return <Circle size={15} aria-hidden="true" />;
}

type EntriesProps = {
  entries: LearningEntry[];
  locked: boolean;
  completed: string[];
  open: (entry: LearningEntry) => void;
};

function PatternMap({ entries, open, locked, completed }: EntriesProps) {
  const topics = Array.from(new Set(entries.map(entry => entry.topic)));
  return <div className="pattern-map">
    <div className="pattern-root"><Code2 size={24} aria-hidden /><strong>DSA patterns</strong></div>
    <ul className="pattern-branches">
      {topics.map(topic => <li className="pattern-branch" key={topic}>
        <div className="pattern-topic">{topic}</div>
        <div className="pattern-nodes">
          {entries.filter(entry => entry.topic === topic).map(entry =>
            <button type="button" key={entry.id} title={entry.summary} onClick={() => open(entry)}>
              {entry.title}<EntryState locked={locked} done={completed.includes(entry.id)} />
            </button>)}
        </div>
      </li>)}
    </ul>
  </div>;
}

function LearningCards({ entries, open, locked, completed }: EntriesProps) {
  return <div className="learning-card-grid">
    {entries.map(entry => <button type="button" key={entry.id} className="public-card preparation-card learning-card" onClick={() => open(entry)}>
      <div className="preparation-card-heading"><span>{entry.topic}</span><EntryState locked={locked} done={completed.includes(entry.id)} /></div>
      <h3>{entry.title}</h3><p>{entry.summary}</p><small>{entry.level}</small>
    </button>)}
  </div>;
}

function CompletionButton({ done, toggle }: { done: boolean; toggle: () => void }) {
  return <button type="button" className="button button-secondary" aria-pressed={done} onClick={toggle}>
    <Check size={17} aria-hidden />{done ? 'Completed' : 'Mark complete'}
  </button>;
}

function LearningNotes({ detail, done, toggle }: { detail: LearningDetail; done: boolean; toggle: () => void }) {
  return <>
    <p className="learning-detail-summary">{detail.summary}</p>
    <div className="learning-notes">
      {detail.notes.map(note => <section key={note.title}><h3>{note.title}</h3><p>{note.text}</p></section>)}
    </div>
    <CompletionButton done={done} toggle={toggle} />
  </>;
}

function LearningContent({ track, view, initialItem, initialPanel, progressKey, loading }: {
  track: LearningTrack; view: LearningView; initialItem: string | null; initialPanel: DsaPanel; progressKey?: string; loading: boolean;
}) {
  const signedIn = Boolean(progressKey);
  const isCourse = view.layout === 'course';
  const isSheet = view.layout === 'sheet';
  const initial = view.entries.find(entry => entry.id === initialItem);
  const lastLessonKey = signedIn && isCourse ? progressKey + ':last-lesson' : undefined;
  const [selected, setSelected] = useState<LearningEntry | undefined>(() => {
    if (initial) return initial;
    if (!lastLessonKey) return undefined;
    const last = readStoredIds(lastLessonKey)?.[0];
    return view.entries.find(entry => entry.id === last) ?? view.entries[0];
  });
  const [courseRevision, setCourseRevision] = useState(0);
  const [gate, setGate] = useState<string | null>(() => !signedIn && initial ?
    learningPath(track, view.id, initial.id, initialPanel) : null);
  const [completed, setCompleted] = useState(() => readStoredIds(progressKey) ?? []);
  const lessonPanel = useRef<HTMLDivElement>(null);

  const detail = useQuery({
    queryKey: ['learning-detail', track, selected?.id],
    queryFn: () => api<LearningDetail>('/learning/' + track + '/' + selected!.id),
    enabled: signedIn && Boolean(selected) && !isSheet,
    staleTime: 5 * 60_000,
  });
  const selectedId = selected?.id;
  useEffect(() => {
    if (lastLessonKey && selectedId) {
      try { localStorage.setItem(lastLessonKey, JSON.stringify([selectedId])); } catch { /* Lessons work without browser storage. */ }
    }
  }, [lastLessonKey, selectedId]);

  const preview = signedIn ? view.entries : view.entries.slice(0, previewCount);

  function open(entry: LearningEntry) {
    if (signedIn) {
      setSelected(entry);
      if (isCourse && window.matchMedia('(max-width: 670px)').matches) {
        requestAnimationFrame(() => lessonPanel.current?.scrollIntoView({ block: 'start' }));
      }
    } else if (!loading) setGate(learningPath(track, view.id, entry.id));
  }

  function toggle(id: string) {
    if (!progressKey) return;
    const current = readStoredIds(progressKey) ?? completed;
    const next = completed.includes(id) ? current.filter(value => value !== id) : Array.from(new Set([...current, id]));
    setCompleted(next);
    try { localStorage.setItem(progressKey, JSON.stringify(next)); } catch { /* Keep progress in this view if storage is unavailable. */ }
  }

  function resetView() {
    if (!progressKey) return;
    const ids = new Set(view.entries.map(entry => entry.id));
    const next = (readStoredIds(progressKey) ?? completed).filter(id => !ids.has(id));
    setCompleted(next);
    if (isCourse) setCourseRevision(value => value + 1);
    try {
      localStorage.setItem(progressKey, JSON.stringify(next));
      if (isCourse) for (const id of ids) localStorage.removeItem(progressKey + ':checklist:' + id);
    } catch { /* Clear what is available when browser storage is restricted. */ }
  }

  const entryProps = { entries: preview, open, locked: !signedIn, completed };
  const boundary = !signedIn && !loading && view.entries.length > previewCount && <PreviewBoundary total={view.entries.length}
    onOpen={() => setGate(current => current ?? learningPath(track, view.id))} />;

  return <div className="learning-section" data-layout={view.layout}>
    {isCourse ? <h2 className="sr-only">{view.title}</h2> : !isSheet && <div className="learning-section-heading">
      <div><h2>{view.title}</h2><p>{view.description}</p></div>
      {signedIn && <ProgressSummary title="Your progress" complete={view.entries.filter(entry => completed.includes(entry.id)).length} total={view.entries.length} />}
    </div>}
    {isSheet ? <Suspense fallback={<Loading label="Opening DSA sheet…" />}>
      <DsaPracticeSheet entries={view.entries.filter(isDsaSheetEntry)} previewLimit={signedIn ? undefined : previewCount}
        progressKey={progressKey} completed={completed} initial={signedIn && initial && isDsaSheetEntry(initial) ? initial : undefined}
        initialPanel={initialPanel} boundary={boundary} onToggle={toggle} onReset={resetView}
        onSignIn={(entry, panel) => { if (!loading) setGate(learningPath(track, view.id, entry?.id, panel)); }} />
    </Suspense> : <>
        {view.layout === 'map' && <PatternMap {...entryProps} />}
        {view.layout === 'cards' && <LearningCards {...entryProps} />}
        {isCourse && <Suspense fallback={<Loading label="Opening course…" />}>
          <SystemDesignCourse key={courseRevision} {...entryProps} selected={selected} detail={detail.data} loading={detail.isPending} lessonPanel={lessonPanel}
            error={detail.error} retry={() => void detail.refetch()} toggle={toggle} reset={resetView} progressKey={progressKey} />
        </Suspense>}
        {boundary}
    </>}
    {!signedIn && !loading && gate && <LearningDialog title="Sign in to keep learning" close={() => setGate(null)}>
      <p>Sign in to open lessons, practice problems, and keep track of what you’ve completed.</p>
      <div className="learning-dialog-actions">
        <button className="button button-secondary" onClick={() => setGate(null)}>Keep browsing</button>
        <Link className="button button-primary" to="/login" state={{ from: gate }}>Sign in</Link>
      </div>
    </LearningDialog>}
    {signedIn && !isCourse && !isSheet && selected && <LearningDialog title={selected.title} close={() => setSelected(undefined)}>
      <span className="learning-label">{selected.topic} · {selected.level}</span>
      {detail.isPending && <Loading label="Opening learning item…" />}
      <ErrorNotice error={detail.error} retry={() => void detail.refetch()} />
      {detail.data && <LearningNotes detail={detail.data} done={completed.includes(selected.id)} toggle={() => toggle(selected.id)} />}
    </LearningDialog>}
  </div>;
}

function Track({ track, inWorkspace }: { track: LearningTrack; inWorkspace: boolean }) {
  const [search] = useSearchParams();
  const { user, loading } = useSession();
  const outline = useQuery(learningOutlineOptions(track));
  const views = outline.data ?? [];
  const active = views.find(view => view.id === search.get('view')) ?? views[0];
  const item = search.get('item');
  const panel = search.get('panel');
  const initialPanel = panel === 'approach' || panel === 'companies' || panel === 'resources' ? panel : 'description';
  const { title, description } = learningTracks[track];
  const progressKey = user ? learningProgressKey(user.id, track) : undefined;

  return <>
    <div className="learning-breadcrumb">
      <Link to={inWorkspace ? prepHubPath : '/#preparation'}>{inWorkspace ? 'Prep Hub' : 'Preparation'}</Link>
      <ChevronRight size={15} aria-hidden /><span>Learning tracks</span>
    </div>
    <header className={'learning-banner' + (active?.layout === 'course' ? ' design-track-banner' : active?.layout === 'sheet' ? ' sheet-track-banner' : '')}>
      <h1>{title}</h1><p>{description}</p>
    </header>
    {views.length > 1 && <nav className="learning-tabs" aria-label={title + ' sections'}>
      {views.map(view => <Link key={view.id} to={queryString({ view: view.id })}
        aria-current={view.id === active?.id ? 'page' : undefined}>{view.title}</Link>)}
    </nav>}
    {outline.isPending && <Loading label="Loading study guide…" />}
    <ErrorNotice error={outline.error} retry={() => void outline.refetch()} />
    {active && <LearningContent key={[track, active.id, item ?? '', initialPanel, progressKey ?? 'guest'].join('/')}
      track={track} view={active} initialItem={item} initialPanel={initialPanel} progressKey={progressKey} loading={loading} />}
  </>;
}

export default function LearningTrackPage({ inWorkspace = false }: { inWorkspace?: boolean }) {
  const { track } = useParams();
  const { user } = useSession();
  const { search } = useLocation();
  if (isLearningTrack(track) && user && !inWorkspace) {
    return <Navigate to={prepHubPath + '/' + track + search} replace />;
  }

  const content = isLearningTrack(track) ? <Track track={track} inWorkspace={inWorkspace} /> : <>
    <h1>Learning track unavailable</h1>
    <Link className="text-link" to={inWorkspace ? prepHubPath : '/#preparation'}>Browse learning tracks</Link>
  </>;
  if (inWorkspace) return <div className="learning-page workspace-learning">{content}</div>;

  return <div className="site-frame public-browse-page">
    <SiteNav />
    <main className="public-content learning-page">{content}</main>
  </div>;
}

