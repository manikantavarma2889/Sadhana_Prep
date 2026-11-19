import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, FileText, Sparkles, Timer } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { difficulties, difficultyLabels, durations, maxUploadBytes, trackLabels, tracks,
  type InterviewSession, type InterviewSettings, type List, type Resume, type RoleAnalysis } from '../../../shared/contracts.ts';
import { InterviewLobby } from '../components/InterviewLobby.tsx';
import { ErrorNotice, PageHeading } from '../components/ui.tsx';
import { trackDetails } from '../features/interview-tracks.ts';
import { api, ApiError } from '../services/api.ts';

const subjects = tracks.filter(track => track !== 'practice');
type PreparationInput = InterviewSettings & { resumeId: string; title: string; description: string };

export function NewInterview() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const restored = useRef(false);
  const creation = useRef<{ input: string; key: string } | null>(null);
  const [settings, setSettings] = useState<InterviewSettings>(() => ({
    track: tracks.find(track => track === search.get('track')) ?? 'practice',
    difficulty: difficulties.find(level => level === search.get('difficulty')) ?? 'intermediate',
    minutes: durations.find(minutes => String(minutes) === search.get('minutes')) ?? 20,
  }));
  const [subject, setSubject] = useState<Exclude<InterviewSettings['track'], 'practice'>>(() => subjects.find(track => track === search.get('practiceTrack')) ?? 'technical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [prepared, setPrepared] = useState<RoleAnalysis | null>(null);
  const [approvedInput, setApprovedInput] = useState('');
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [lobby, setLobby] = useState<InterviewSettings | null>(null);
  const [readAloud, setReadAloud] = useState(true);
  const practice = settings.track === 'practice';
  const input: PreparationInput = { track: settings.track, difficulty: settings.difficulty, minutes: settings.minutes,
    ...(practice ? { practiceTrack: subject } : {}), resumeId,
    title: practice ? '' : title.trim(), description: practice ? '' : description.trim() };
  const fingerprint = JSON.stringify(input);
  const resumes = useQuery({ queryKey: ['resume-options'], queryFn: () => api<List<Resume>>('/resumes') });
  const saved = useQuery({ queryKey: ['role-analysis', search.get('analysis')],
    queryFn: () => api<RoleAnalysis>('/role-analyses/' + search.get('analysis')), enabled: Boolean(search.get('analysis')) });
  useEffect(() => {
    const data = saved.data;
    if (restored.current || !data?.preparation) return;
    restored.current = true;
    const next = data.preparation;
    setSettings(next); setSubject(next.practiceTrack ?? 'technical'); setResumeId(data.resumeId ?? '');
    setTitle(data.title); setDescription(data.description ?? ''); setPrepared(data);
    setApprovedInput(JSON.stringify({ track: next.track, difficulty: next.difficulty, minutes: next.minutes,
      ...(next.practiceTrack ? { practiceTrack: next.practiceTrack } : {}), resumeId: data.resumeId ?? '',
      title: next.track === 'practice' ? '' : data.title, description: next.track === 'practice' ? '' : data.description ?? '' }));
  }, [saved.data]);
  const upload = useMutation({
    mutationFn: (file: File) => { const payload = new FormData(); payload.set('resume', file);
      return api<Resume>('/resumes', { method: 'POST', body: payload }); },
    onSuccess: data => {
      setResumeId(data.id);
      cache.setQueryData<List<Resume>>(['resume-options'], old => ({ items: [data, ...(old?.items ?? [])], nextCursor: old?.nextCursor ?? null }));
      void cache.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
  const analyze = useMutation({
    mutationFn: (body: PreparationInput) => api<RoleAnalysis>('/interview-preparations', { method: 'POST', body }),
    onSuccess: (data, body) => { setPrepared(data); setApprovedInput(JSON.stringify(body));
      cache.setQueryData(['role-analysis', data.id], data); },
  });
  const create = useMutation({
    mutationFn: (body: InterviewSettings) => {
      const value = JSON.stringify(body);
      if (creation.current?.input !== value) creation.current = { input: value, key: crypto.randomUUID() };
      return api<InterviewSession>('/interviews', { method: 'POST', body, idempotencyKey: creation.current.key });
    },
    onSuccess: (data, body) => {
      cache.setQueryData(['interview', data.id], data);
      for (const key of ['interviews', 'interview-history']) void cache.invalidateQueries({ queryKey: [key] });
      navigate('/interviews/' + data.id, { state: { readAloud, joinedFromLobby: true, analysisId: body.analysisId } });
    },
    onError: error => { if (error instanceof ApiError && ['RESUME_CHANGED', 'ANALYSIS_REQUIRED'].includes(error.code)) setApprovedInput(''); },
  });
  const profile = resumes.data?.items.find(item => item.id === resumeId);
  const valid = Boolean(resumeId && profile?.hasContent && (practice || (title.trim().length >= 2 && description.trim().length >= 20)));
  const busy = upload.isPending || analyze.isPending;
  const ready = valid && !busy && Boolean(prepared && fingerprint === approvedInput);
  return <>
    <PageHeading title="New interview" description="Set the context. Analyze your resume and role. Then meet Sadhana." />
    <div className="interview-setup-grid">
      <section className="panel form-panel">
        <div className="panel-heading"><div><p className="setup-eyebrow">01 / YOUR SESSION</p><h2>Configure your session</h2></div><Timer size={22} aria-hidden /></div>
        <form className="form-stack" onSubmit={event => { event.preventDefault(); if (valid && !busy) analyze.mutate(input); }}>
          <div><label>Interview track<select aria-describedby="track-description" value={settings.track} onChange={event => setSettings({ ...settings, track: event.target.value as InterviewSettings['track'] })}>
            {tracks.map(track => <option key={track} value={track}>{trackLabels[track]}</option>)}
          </select></label><small id="track-description" className="form-hint">{trackDetails[settings.track].description}</small></div>
          {practice && <div><label>Practice subject<select aria-describedby="practice-description" value={subject} onChange={event => setSubject(event.target.value as typeof subject)}>
            {subjects.map(track => <option key={track} value={track}>{trackLabels[track]}</option>)}
          </select></label><small id="practice-description" className="form-hint">Practice without a role title or job description. Your resume is required.</small></div>}
          {!practice && <>
            <label>Role title<input name="title" value={title} onChange={event => setTitle(event.target.value)} required minLength={2} maxLength={90} placeholder="e.g. Frontend Engineer" /></label>
            <label>Job description<textarea name="description" value={description} onChange={event => setDescription(event.target.value)} required minLength={20} maxLength={8000} rows={5}
              placeholder="Paste the requirements and responsibilities for your target role…" /></label>
          </>}
          <div className="field-row">
            <label>Difficulty<select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value as InterviewSettings['difficulty'] })}>
              {difficulties.map(level => <option key={level} value={level}>{difficultyLabels[level]}</option>)}
            </select></label>
            <label>Duration<select value={settings.minutes} onChange={event => setSettings({ ...settings, minutes: Number(event.target.value) as InterviewSettings['minutes'] })}>
              {durations.map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select></label>
          </div>
          <div className="setup-resume-block">
            <label>Resume profile<select value={resumeId} required onChange={event => setResumeId(event.target.value)}>
              <option value="">Select a resume — required</option>
              {resumes.data?.items.map(item => <option key={item.id} value={item.id}>{item.label}{item.hasContent ? '' : ' — upload again'}</option>)}
            </select></label>
            <label className="setup-upload-label"><FileText size={18} aria-hidden />Upload a new resume
              <input type="file" accept=".pdf,application/pdf" aria-label="Upload interview resume" disabled={upload.isPending} onChange={event => {
                const file = event.target.files?.[0]; if (!file) return; setUploadError(null);
                if (file.size > maxUploadBytes) { setUploadError(new Error('Choose a PDF smaller than 4 MB.')); return; }
                upload.mutate(file);
              }} /></label>
            <small className="form-hint">{upload.isPending ? 'Extracting resume content…' : 'Text-based PDF, up to 4 MB. Projects, technologies and experience are used to personalize your questions.'} <Link to="/resumes">Manage resumes</Link></small>
            {profile && !profile.hasContent && <p className="notice">This older profile contains skills only. Upload the PDF again to analyze its projects and experience.</p>}
          </div>
          <ErrorNotice error={uploadError ?? upload.error ?? analyze.error ?? resumes.error ?? saved.error} />
          <div className="setup-actions">
            <button className="button button-secondary" disabled={!valid || busy}><Sparkles size={17} aria-hidden />{analyze.isPending ? 'Analyzing resume and role…' : 'Analyze interview'}</button>
            <button type="button" className="button button-primary" disabled={!ready} onClick={() => {
              if (ready && prepared) setLobby({ track: settings.track, difficulty: settings.difficulty, minutes: settings.minutes,
                ...(practice ? { practiceTrack: subject } : {}), analysisId: prepared.id });
            }}>Start interview <ArrowRight size={17} aria-hidden /></button>
          </div>
          <small className="form-hint" role="status">{ready ? 'Analysis complete. Your interview is ready.' : prepared ? 'Your setup changed. Analyze again before starting.' : 'Complete the setup and analyze it to unlock Start interview.'}</small>
        </form>
      </section>
      <aside className="panel form-panel setup-analysis" aria-label="Interview analysis">
        <p className="setup-eyebrow">02 / YOUR INTERVIEW</p>
        <h2>{ready ? 'Ready for your role' : 'A session built around you'}</h2>
        <div className="setup-session-summary"><strong>{trackLabels[practice ? subject : settings.track]}</strong><span>{difficultyLabels[settings.difficulty]} · {settings.minutes} minutes</span></div>
        <p>Sadhana begins with your introduction, then asks questions focused on your track and role. Your projects and experience add context, alongside a smaller number of behavioral questions.</p>
        <p>Questions continue for your selected duration. Easy stays easy. Intermediate and hard sessions begin with fundamentals before moving to the selected level.</p>
        {prepared && <div className="analysis-preview">
          {ready && <p className="success-text"><CheckCircle2 size={17} aria-hidden /> Analysis complete</p>}
          <h3>{prepared.title}</h3>
          {prepared.resumeSummary && <p>{prepared.resumeSummary}</p>}
          <h4>Focus areas</h4><div className="chips">{prepared.topics.map(topic => <span key={topic}>{topic}</span>)}</div>
          {Boolean(prepared.projects?.length) && <><h4>Projects from your resume</h4>{prepared.projects!.map(project => <div className="setup-project" key={project.name}><strong>{project.name}</strong><p>{project.summary}</p></div>)}</>}
          {Boolean(prepared.gaps.length) && <><h4>Role skills to prepare</h4><div className="chips">{prepared.gaps.map(skill => <span key={skill}>{skill}</span>)}</div></>}
        </div>}
      </aside>
    </div>
    {lobby && <InterviewLobby join={() => create.mutate(lobby)} back={() => { create.reset(); setLobby(null); }}
      pending={create.isPending} error={create.error} settings={lobby} roleTitle={prepared?.title}
      readAloud={readAloud} setReadAloud={setReadAloud} />}
  </>;
}
