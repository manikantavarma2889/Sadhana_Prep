import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileText, Sparkles, UploadCloud } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  difficulties, durations, interviewQuestionCounts, maxUploadBytes, trackLabels, tracks, type InterviewSession, type InterviewSettings,
  type List, type Resume, type RoleAnalysis,
} from '../../../shared/contracts.ts';
import { InterviewLobby } from '../components/InterviewLobby.tsx';
import { Empty, ErrorNotice, formatDate, Loading, PageHeading } from '../components/ui.tsx';
import { trackDetails } from '../features/interview-tracks.ts';
import { api, queryString } from '../services/api.ts';

function library<T>(path: string, cursor?: string) {
  return api<List<T>>(path + queryString({ cursor }));
}

export function NewInterview() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [search] = useSearchParams();
  const [settings, setSettings] = useState<InterviewSettings>(() => ({
    track: tracks.find(track => track === search.get('track')) ?? 'mern',
    difficulty: difficulties.find(level => level === search.get('difficulty')) ?? 'intermediate',
    minutes: durations.find(minutes => String(minutes) === search.get('minutes')) ?? 20,
  }));
  const [selectedId, select] = useState(search.get('analysis') ?? '');
  const [profileId, setProfileId] = useState('');
  const [lobbySettings, setLobbySettings] = useState<InterviewSettings | null>(null);
  const [openReturningLobby, setOpenReturningLobby] = useState(search.get('lobby') === '1');
  const [readAloud, setReadAloud] = useState(true);
  const creation = useRef<{ input: string; key: string } | null>(null);
  const resumes = useQuery({ queryKey: ['resume-options'], queryFn: () => library<Resume>('/resumes') });
  const analyses = useQuery({ queryKey: ['analysis-options'], queryFn: () => library<RoleAnalysis>('/role-analyses') });
  const selected = useQuery({
    queryKey: ['role-analysis', selectedId], queryFn: () => api<RoleAnalysis>('/role-analyses/' + selectedId), enabled: Boolean(selectedId),
  });
  useEffect(() => {
    if (!openReturningLobby || (selectedId && !selected.data && !selected.isError)) return;
    setOpenReturningLobby(false);
    if (!selected.isError) setLobbySettings({ ...settings, ...(selectedId ? { analysisId: selectedId } : {}) });
  }, [openReturningLobby, selected.data, selected.isError, selectedId, settings]);
  const analyze = useMutation({
    mutationFn: (body: { title: string; description: string; resumeId?: string }) =>
      api<RoleAnalysis>('/role-analyses', { method: 'POST', body }),
    onSuccess: data => {
      cache.setQueryData(['role-analysis', data.id], data);
      void cache.invalidateQueries({ queryKey: ['analysis-options'] });
      select(data.id);
    },
  });
  const create = useMutation({
    mutationFn: (body: InterviewSettings) => {
      const input = JSON.stringify(body);
      if (creation.current?.input !== input) creation.current = { input, key: crypto.randomUUID() };
      return api<InterviewSession>('/interviews', { method: 'POST', body, idempotencyKey: creation.current.key });
    },
    onSuccess: (data, requestedSettings) => {
      cache.setQueryData(['interview', data.id], data);
      for (const key of ['interviews', 'interview-history']) void cache.invalidateQueries({ queryKey: [key] });
      navigate('/interviews/' + data.id, { state: { readAloud, joinedFromLobby: true, analysisId: requestedSettings.analysisId } });
    },
  });
  function roleAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    analyze.mutate({ title: String(data.get('title')), description: String(data.get('description')), ...(profileId ? { resumeId: profileId } : {}) });
  }
  return <>
    <PageHeading title="New interview" description="Choose what to practice and add optional context from a target role." />
    <div className="split-grid">
      <section className="panel form-panel">
        <h2>Configure your session</h2>
        <form className="form-stack" onSubmit={event => {
          event.preventDefault();
          setLobbySettings({ ...settings, ...(selectedId ? { analysisId: selectedId } : {}) });
        }}>
          <fieldset className="form-stack">
            <legend>Interview track</legend>
            <div className="track-grid">{tracks.map(track => {
              const { icon: Icon, description } = trackDetails[track];
              return <label className="track-option" key={track}>
                <input type="radio" name="track" value={track} checked={settings.track === track}
                  onChange={() => setSettings({ ...settings, track })} />
                <span><Icon size={21} aria-hidden /><strong>{trackLabels[track]}</strong><small>{description}</small></span>
              </label>;
            })}</div>
          </fieldset>
          <div className="field-row">
            <label>Difficulty<select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value as InterviewSettings['difficulty'] })}>
              {difficulties.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select></label>
            <label>Duration<select value={settings.minutes} onChange={event => setSettings({ ...settings, minutes: Number(event.target.value) as InterviewSettings['minutes'] })}>
              {durations.map(value => <option key={value} value={value}>{value} minutes</option>)}
            </select></label>
          </div>
          <div className="form-footer">
            <small><strong>{interviewQuestionCounts[settings.minutes]} planned questions.</strong> The timer starts when your first question is ready.</small>
            <button className="button button-primary" disabled={analyze.isPending || Boolean(selectedId && !selected.data)}>
              Start interview <ArrowRight size={17} aria-hidden />
            </button>
          </div>
        </form>
      </section>
      <section className="panel form-panel role-panel">
        <div className="panel-heading"><div><h2>Target role</h2><p>Optional. Add a job description to personalize your questions.</p></div>
          <span className="heading-icon"><Sparkles size={20} aria-hidden /></span></div>
        {Boolean(analyses.data?.items.length || selectedId) && <label className="stacked-label">Saved role analysis
          <select value={selectedId} onChange={event => select(event.target.value)}>
            <option value="">General practice</option>
            {analyses.data?.items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            {selected.data && !analyses.data?.items.some(item => item.id === selectedId) &&
              <option value={selected.data.id}>{selected.data.title}</option>}
          </select></label>}
        <ErrorNotice error={selected.error} />
        {selected.isError && <button className="button button-small button-secondary" onClick={() => select('')}>Clear selected role</button>}
        {selected.data && <article className="analysis-preview">
          <h3>{selected.data.title}</h3>
          <SkillGroup title="Matched skills" values={selected.data.matches} />
          <SkillGroup title={selected.data.resumeId ? 'Skill gaps to practice' : 'Required skills to practice'} values={selected.data.gaps} />
          <SkillGroup title="Preferred skills" values={selected.data.preferred} />
          <SkillGroup title="Interview topics" values={selected.data.topics} />
          <button className="text-link" type="button" onClick={() => select('')}>Use general practice</button>
        </article>}
        <form className="form-stack role-form" onSubmit={roleAnalysis}>
          <label>Role title<input name="title" required minLength={2} maxLength={90} placeholder="e.g. Frontend Engineer" /></label>
          <label>Job description<textarea name="description" required minLength={20} maxLength={8000} rows={5}
            placeholder="Paste the role requirements and responsibilities…" /></label>
          <label>Resume profile<select value={profileId} onChange={event => setProfileId(event.target.value)}>
            <option value="">No resume selected</option>
            {resumes.data?.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <small className="form-hint">The configured provider receives the job text and selected skill names. <Link to="/resumes">Manage resumes</Link></small>
          <ErrorNotice error={analyze.error ?? resumes.error ?? analyses.error} />
          <button className="button button-secondary" disabled={analyze.isPending}>
            <Sparkles size={16} aria-hidden />{analyze.isPending ? 'Analyzing role…' : 'Analyze job description'}</button>
        </form>
      </section>
    </div>
    {lobbySettings && <InterviewLobby join={() => create.mutate(lobbySettings)} back={() => { create.reset(); setLobbySettings(null); }}
      pending={create.isPending} error={create.error} settings={lobbySettings} update={setLobbySettings} roleTitle={selected.data?.title}
      readAloud={readAloud} setReadAloud={setReadAloud} />}
  </>;
}

function SkillGroup({ title, values }: { title: string; values: string[] }) {
  return <div className="skill-group"><strong>{title}</strong>
    {values.length ? <div className="chips">{values.map(skill => <span key={skill}>{skill}</span>)}</div>
      : <small>None identified</small>}
  </div>;
}

function ResumeCard({ resume, refresh }: { resume: Resume; refresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const save = useMutation({
    mutationFn: (body: { label: string; skills: string[] }) => api<Resume>('/resumes/' + resume.id, { method: 'PATCH', body }),
    onSuccess: () => { setEditing(false); refresh(); },
  });
  const remove = useMutation({
    mutationFn: () => api<void>('/resumes/' + resume.id, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  return <article className="panel resume-card">
    <div className="panel-heading"><div className="resume-title"><span className="row-icon"><FileText size={20} aria-hidden /></span>
      <div><h2>{resume.label}</h2><p>Added {formatDate(resume.createdAt)}</p></div></div></div>
    {editing ? <form className="form-stack" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      save.mutate({ label: String(data.get('label')), skills: String(data.get('skills')).split(',').map(value => value.trim()).filter(Boolean) });
    }}>
      <label>Resume label<input name="label" defaultValue={resume.label} minLength={2} maxLength={90} required /></label>
      <label>Skills, separated by commas<textarea name="skills" defaultValue={resume.skills.join(', ')} rows={3} maxLength={2200} /></label>
      <div className="button-group"><button className="button button-primary button-small" disabled={save.isPending}>Save skills</button>
        <button type="button" className="button button-secondary button-small" onClick={() => setEditing(false)}>Cancel</button></div>
    </form> : <>
      <SkillGroup title="Extracted skills" values={resume.skills} />
      <div className="button-group"><button className="button button-secondary button-small" onClick={() => setEditing(true)}>Edit skills</button>
        <button className="button button-small button-plain danger-text" onClick={() => setConfirm(true)}>Delete profile</button></div>
    </>}
    {confirm && <div className="notice notice-error"><span>Delete this resume profile?</span>
      <button className="button button-danger button-small" onClick={() => remove.mutate()} disabled={remove.isPending}>Delete</button>
      <button className="button button-secondary button-small" onClick={() => setConfirm(false)}>Cancel</button></div>}
    <ErrorNotice error={save.error ?? remove.error} />
  </article>;
}

export function ResumePage() {
  const cache = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['resumes'], initialPageParam: '', queryFn: ({ pageParam }) => library<Resume>('/resumes', pageParam),
    getNextPageParam: page => page.nextCursor,
  });
  function refresh() {
    for (const key of ['resumes', 'resume-options']) void cache.invalidateQueries({ queryKey: [key] });
  }
  const upload = useMutation({
    mutationFn: (resume: File) => {
      const body = new FormData();
      body.set('resume', resume);
      return api<Resume>('/resumes', { method: 'POST', body });
    },
    onSuccess: () => {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setMessage('Resume processed. Review the extracted skills below.');
      refresh();
    },
  });
  const resumes = query.data?.pages.flatMap(page => page.items) ?? [];
  return <>
    <PageHeading title="Resume library" description="Build a verified skill profile to use in job and interview preparation." />
    <section className="panel form-panel upload-panel">
      <div className="upload-icon"><UploadCloud size={29} aria-hidden /></div>
      <h2>Upload a resume</h2>
      <p>Text-based PDF, up to 4 MB. Sadhana Prep saves the skill profile and discards the PDF after processing.</p>
      <form className="upload-form" onSubmit={event => {
        event.preventDefault();
        if (file) upload.mutate(file);
      }}>
        <label className="file-picker"><span className="sr-only">Choose a PDF resume</span><input ref={fileInput} type="file"
          accept=".pdf,application/pdf" onChange={event => { setFile(event.target.files?.[0] ?? null); setMessage(''); upload.reset(); }} /></label>
        <button className="button button-primary" disabled={!file || file.size > maxUploadBytes || upload.isPending}>
          {upload.isPending ? 'Extracting skills…' : 'Upload and extract'}</button>
      </form>
      {file && file.size > maxUploadBytes && <ErrorNotice error={new Error('Choose a PDF smaller than 4 MB.')} />}
      <ErrorNotice error={upload.error ?? query.error} retry={query.isError ? () => void query.refetch() : undefined} />
      {message && <p className="success-text" role="status">{message}</p>}
    </section>
    <h2 className="section-title">Saved profiles</h2>
    {query.isPending ? <Loading label="Loading resumes…" /> : resumes.length
      ? <div className="resume-grid">{resumes.map(resume => <ResumeCard key={resume.id} resume={resume} refresh={refresh} />)}</div>
      : !query.isError && <section className="panel"><Empty icon={<FileText size={22} aria-hidden />} title="No resume profiles yet"><p>Upload a PDF to get started.</p></Empty></section>}
    {query.hasNextPage && <div className="pager"><button className="button button-secondary" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>Load more</button></div>}
  </>;
}
