import { useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowRight, AudioLines, BookOpen, ChartNoAxesCombined, ClipboardList, FileText, Plus, Timer, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  difficulties, trackLabels, tracks, type Difficulty, type InterviewSummary, type List, type Track, type Trends, type User,
} from '../../../shared/contracts.ts';
import { PinnedSubjects, PrepHubProgress } from '../components/DashboardLearning.tsx';
import { LearningTrackCards } from '../components/LearningTrackCards.tsx';
import { PasswordSettings } from '../components/PasswordSettings.tsx';
import { Empty, ErrorNotice, formatDate, Loading, PageHeading, providerLabel, StatusPill } from '../components/ui.tsx';
import { prepHubPath } from '../features/learning-tracks.ts';
import { api, queryString } from '../services/api.ts';
import { useSession } from '../services/session.tsx';
import './dashboard.css';

function useRecent() {
  return useQuery({ queryKey: ['interviews'], queryFn: () => api<List<InterviewSummary>>('/interviews') });
}

function InterviewRow({ interview, remove }: { interview: InterviewSummary; remove?: () => void }) {
  const active = interview.status === 'active';
  const href = '/interviews/' + interview.id + (active ? '' : '/report');
  return <div className="interview-row">
    <div className="interview-cell">
      <span className="row-icon"><AudioLines size={19} aria-hidden /></span>
      <div><Link className="row-title" to={href}>{interview.role ?? trackLabels[interview.track]}</Link>
      <small>{trackLabels[interview.track]} <span aria-hidden>·</span> {interview.difficulty} <span aria-hidden>·</span> {formatDate(interview.startedAt)}</small></div>
    </div>
    <StatusPill active={active} />
    <span className="row-score">{interview.score === null ? '—' : interview.score + '%'}</span>
    <Link className="icon-button" to={href} aria-label={(active ? 'Resume ' : 'View report for ') + (interview.role ?? trackLabels[interview.track])}><ArrowRight size={18} aria-hidden /></Link>
    {remove && <button className="icon-button danger-text" onClick={remove} aria-label={'Delete ' + (interview.role ?? trackLabels[interview.track])}><Trash2 size={16} aria-hidden /></button>}
  </div>;
}

function PracticeTrend() {
  const [track, setTrack] = useState<Track>('mern');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const query = useQuery({
    queryKey: ['trends', track, difficulty],
    queryFn: () => api<Trends>('/metrics/interview-trends' + queryString({ track, difficulty })),
  });
  return <section className="panel trend-panel">
    <div className="panel-heading"><div><h2>Performance trend</h2><p>Compare coaching scores for the same track and difficulty.</p></div>
      <span className="heading-icon"><ChartNoAxesCombined size={20} aria-hidden /></span></div>
    <div className="trend-filters">
      <label><span className="sr-only">Trend track</span><select value={track} onChange={event => setTrack(event.target.value as Track)}>
        {tracks.map(value => <option key={value} value={value}>{trackLabels[value]}</option>)}
      </select></label>
      <label><span className="sr-only">Trend difficulty</span><select value={difficulty} onChange={event => setDifficulty(event.target.value as Difficulty)}>
        {difficulties.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </select></label>
    </div>
    {query.isPending ? <Loading label="Loading scores…" /> : query.isError ? <ErrorNotice error={query.error} retry={() => void query.refetch()} /> :
      query.data.points.length ? <div className="chart" aria-label="Recent practice scores">
        <div className="chart-axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
        <div className="chart-plot">{query.data.points.map(point =>
          <Link key={point.id} to={'/interviews/' + point.id + '/report'}
            aria-label={formatDate(point.date) + ', score ' + point.score + ' percent, coverage ' + Math.round(point.coverage * 100) + ' percent'}
            className="chart-column" title={formatDate(point.date) + ' · ' + point.score + '% score · ' + Math.round(point.coverage * 100) + '% coverage'}>
            <span style={{ height: Math.max(point.score, 2) + '%' }} /></Link>)}</div>
      </div> : <Empty icon={<Activity size={22} aria-hidden />} title="Your scores will appear here">
        <p>Finish an interview in this track and difficulty to add your first result.</p></Empty>}
    {query.data && <div className="chart-meta">{providerLabel[query.data.provider]} <span>·</span> {query.data.points.length} comparable results</div>}
  </section>;
}

function InterviewProgress({ recent }: { recent: ReturnType<typeof useRecent> }) {
  const interviews = recent.data?.items ?? [];
  const completed = interviews.filter(item => item.status === 'completed').length;
  const scored = interviews.flatMap(item => item.score === null || item.reportStatus !== 'ready' ? [] : [item.score]);
  const average = scored.length ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length) + '%' : '—';
  const percentage = interviews.length ? (completed / interviews.length) * 100 : 0;
  return <section className="panel overview-progress-card" aria-labelledby="interview-progress-title">
    <div className="overview-progress-heading"><h2 id="interview-progress-title">Interview Progress</h2>
      <Link to="/history" className="overview-progress-link" aria-label="Open interview history"><ArrowRight size={16} aria-hidden /></Link>
    </div>
    {recent.isPending ? <Loading label="Loading interview progress…" /> :
      !recent.data ? <ErrorNotice error={recent.error} retry={() => void recent.refetch()} /> :
      <>
        <div className="overview-interview-summary">
          <div className="overview-interview-ring" role="img" aria-label={completed + ' of ' + interviews.length + ' recent interviews completed'}
            style={{ background: interviews.length ? 'conic-gradient(var(--interview-done) ' + percentage + '%, var(--interview-active) ' + percentage + '%)' : undefined }}>
            <div className="overview-interview-ring-center" aria-hidden="true">
              <strong>{completed}</strong><span>of {interviews.length} completed</span>
            </div>
          </div>
          <dl className="overview-interview-stats">
            <div><dt className="overview-stat-done">Completed</dt><dd>{completed}</dd></div>
            <div><dt className="overview-stat-active">In progress</dt><dd>{interviews.length - completed}</dd></div>
            <div><dt>Avg. score</dt><dd>{average}</dd></div>
          </dl>
        </div>
        {recent.data.nextCursor && <p className="overview-progress-caption">Based on your latest {interviews.length} interviews.</p>}
      </>}
  </section>;
}

export function Dashboard() {
  const { user } = useSession();
  const recent = useRecent();
  const interviews = recent.data?.items ?? [];
  const active = interviews.find(item => item.status === 'active');

  return <div className="dashboard-overview">
    <div className="panel overview-primary">
      <header className="overview-welcome">
        <h1>{'Welcome, ' + (user?.name.split(' ')[0] ?? 'candidate')}</h1>
        <p>Build your skills, practice a mock interview, and review your progress.</p>
      </header>
      {user && <PinnedSubjects key={user.id} userId={user.id} />}
      <section className="overview-interview-action" aria-labelledby="overview-interview-title">
        <span className="row-icon"><AudioLines size={20} aria-hidden /></span>
        <div><h2 id="overview-interview-title">{active ? 'Interview in progress' : 'Mock interview'}</h2>
          <p>{active ? 'Return to your saved questions and answers.' : 'Choose a track and practice questions for your target role.'}</p>
        </div>
        <Link className="button button-primary button-small" to={active ? '/interviews/' + active.id : '/interviews/new'}>
          {active ? 'Resume interview' : 'Start an interview'}<ArrowRight size={16} aria-hidden />
        </Link>
      </section>
      <section aria-labelledby="overview-subjects-title">
        <div className="overview-section-heading"><h2 id="overview-subjects-title"><BookOpen size={17} aria-hidden />Explore learning tracks</h2></div>
        <LearningTrackCards basePath={prepHubPath} compact />
      </section>
    </div>
    <aside className="overview-progress" aria-label="Practice progress">
      <InterviewProgress recent={recent} />
      {user && <PrepHubProgress userId={user.id} />}
    </aside>
    <div className="overview-activity">
      <PracticeTrend />
      <section className="panel history-panel">
        <div className="panel-heading"><div><h2>Recent interviews</h2><p>Resume a session or open a completed report.</p></div><Link className="text-link" to="/history">View history <ArrowRight size={15} aria-hidden /></Link></div>
        {recent.isPending ? <Loading label="Loading interviews…" /> : recent.isSuccess && interviews.length
          ? interviews.slice(0, 4).map(item => <InterviewRow key={item.id} interview={item} />)
          : recent.isSuccess && <Empty icon={<ClipboardList size={22} aria-hidden />} title="No interviews yet"><p>Your practice sessions will be saved here.</p></Empty>}
        {recent.isError && <ErrorNotice error={recent.error} retry={() => void recent.refetch()} />}
      </section>
      <section className="panel next-panel">
        <div className="panel-heading"><div><h2>Prepare for a role</h2><p>Use a job description to focus your practice.</p></div></div>
        <Link className="quick-link" to="/resumes"><span className="row-icon"><FileText size={19} aria-hidden /></span><span><strong>Review resume skills</strong><small>Upload a PDF and check extracted skills.</small></span><ArrowDownRight size={18} aria-hidden /></Link>
        <Link className="quick-link" to="/interviews/new"><span className="row-icon"><Plus size={20} aria-hidden /></span><span><strong>Analyze a job description</strong><small>Identify skill gaps and practice topics.</small></span><ArrowDownRight size={18} aria-hidden /></Link>
      </section>
    </div>
  </div>;
}

export function HistoryPage() {
  const cache = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['interview-history'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<List<InterviewSummary>>('/interviews' + queryString({ cursor: pageParam })),
    getNextPageParam: page => page.nextCursor,
  });
  const [selected, select] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api<void>('/interviews/' + id, { method: 'DELETE' }),
    onSuccess: () => {
      select(null);
      for (const key of ['interview-history', 'interviews', 'trends']) void cache.invalidateQueries({ queryKey: [key] });
    },
  });
  const interviews = query.data?.pages.flatMap(page => page.items) ?? [];
  return <>
    <PageHeading title="Interview history" description="Return to an uncompleted session or review previous coaching reports."
      action={<Link className="button button-primary" to="/interviews/new"><Plus size={17} aria-hidden /> New interview</Link>} />
    <ErrorNotice error={query.error ?? remove.error} retry={query.isError ? () => void query.refetch() : undefined} />
    {selected && <div className="notice notice-error" role="alert"><span>Delete this interview, including its answers and report?</span>
      <button className="button button-small button-danger" onClick={() => remove.mutate(selected)} disabled={remove.isPending}>Delete interview</button>
      <button className="button button-small button-secondary" onClick={() => { select(null); remove.reset(); }} disabled={remove.isPending}>Cancel</button></div>}
    <section className="panel history-panel">
      {query.isPending ? <Loading label="Loading interview history…" /> : interviews.length
        ? interviews.map(item => <InterviewRow key={item.id} interview={item} remove={() => { remove.reset(); select(item.id); }} />)
        : !query.isError && <Empty icon={<Timer size={22} aria-hidden />} title="No interviews yet"><Link to="/interviews/new" className="text-link">Start an interview <ArrowRight size={15} aria-hidden /></Link></Empty>}
      {query.hasNextPage && <div className="pager"><button className="button button-secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</button></div>}
    </section>
  </>;
}

export function SettingsPage() {
  const { user, update } = useSession();
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (input: { name: string; voiceEnabled: boolean }) => api<User>('/me', { method: 'PATCH', body: input }),
    onSuccess: user => { update(user); setSaved(true); },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save.mutate({ name: String(data.get('name')), voiceEnabled: data.has('voice') });
  }
  return <>
    <PageHeading title="Settings" description="Manage your profile, interview preferences, and password." />
    <section className="panel form-panel settings-panel">
      <h2>Profile</h2>
      <form onSubmit={submit} onChange={() => setSaved(false)} className="form-stack">
        <label>Display name<input name="name" defaultValue={user?.name} required minLength={2} maxLength={80} /></label>
        <label>Email address<input value={user?.email ?? ''} readOnly /></label>
        <label className="check-line"><input type="checkbox" name="voice" defaultChecked={user?.voiceEnabled} /> Show microphone and playback controls</label>
        <ErrorNotice error={save.error} />
        {saved && <p className="success-text" role="status">Settings saved.</p>}
        <div><button className="button button-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </section>
    <PasswordSettings />
  </>;
}
