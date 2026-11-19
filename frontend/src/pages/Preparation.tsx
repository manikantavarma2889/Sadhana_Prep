import { useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, UploadCloud } from 'lucide-react';
import { maxUploadBytes, type List, type Resume } from '../../../shared/contracts.ts';
import { Empty, ErrorNotice, formatDate, Loading, PageHeading } from '../components/ui.tsx';
import { api, queryString } from '../services/api.ts';
export { NewInterview } from './NewInterview.tsx';

function library<T>(path: string, cursor?: string) {
  return api<List<T>>(path + queryString({ cursor }));
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
    <PageHeading title="Resume library" description="Keep resume projects, experience and skills ready for your next interview." />
    <section className="panel form-panel upload-panel">
      <div className="upload-icon"><UploadCloud size={29} aria-hidden /></div>
      <h2>Upload a resume</h2>
      <p>Text-based PDF, up to 4 MB. Sadhana Prep saves extracted text for interview analysis and discards the PDF after processing.</p>
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
