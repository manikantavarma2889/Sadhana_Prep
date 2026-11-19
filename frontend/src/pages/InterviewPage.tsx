import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { dimensions, trackLabels, type AnswerFeedback, type InterviewReport, type InterviewSession, type Turn } from '../../../shared/contracts.ts';
import { openingQuestion, openingTopic } from '../../../shared/interview-opening.ts';
import { InterviewRoom, type InterviewPanel } from '../components/InterviewRoom.tsx';
import { interviewMetrics, interviewerName } from '../components/InterviewMedia.tsx';
import { ErrorNotice, Loading, providerLabel } from '../components/ui.tsx';
import { api, queryString } from '../services/api.ts';

const label = Object.fromEntries(dimensions);
const path = (id: string) => '/interviews/' + id;

function useInterview(id: string) {
  return useQuery({ queryKey: ['interview', id], queryFn: () => api<InterviewSession>(path(id)), staleTime: 0 });
}

function useClock(deadline: string | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000)) : null;
}

export function InterviewPage() {
  const id = useParams().id ?? '';
  const query = useInterview(id);
  const { refetch } = query;
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [panel, setPanel] = useState<InterviewPanel>(() => window.matchMedia('(min-width: 761px)').matches ? 'chat' : null);
  const [captions, setCaptions] = useState(true);
  const [autoListen, setAutoListen] = useState(state?.joinedFromLobby === true);
  const interview = query.data;
  const active = interview?.status === 'active';
  const seconds = useClock(active ? interview.deadlineAt : undefined);
  useEffect(() => {
    if (seconds === 0) void refetch();
  }, [seconds, refetch]);

  function commit(change: InterviewSession) {
    cache.setQueryData(['interview', id], change);
    for (const key of ['interviews', 'interview-history', 'trends']) void cache.invalidateQueries({ queryKey: [key] });
    if (change.status === 'completed') navigate(path(id) + '/report', { replace: true, state });
  }

  const finish = useMutation({
    mutationFn: () => api<InterviewSession>(path(id) + '/finish', { method: 'POST' }),
    onSuccess: commit,
  });
  if (query.isPending) return <Loading label="Loading interview…" />;
  if (query.isError || !interview) return <ErrorNotice error={query.error} retry={() => void refetch()} />;
  if (!active || !interview.question) return <Navigate to={path(id) + '/report'} replace state={state} />;
  const warmUp = state?.joinedFromLobby === true && !interview.turns.length && interview.question.topic !== openingTopic &&
    state?.warmUpAnswer === undefined;
  const question = warmUp
    ? { id: interview.id + '-warm-up', text: openingQuestion(interview.role), topic: openingTopic, followUp: false }
    : interview.question;
  const expired = Date.parse(interview.deadlineAt) <= Date.now();
  return <InterviewRoom key={question.id} interview={interview} question={question} seconds={seconds} expired={expired}
    end={() => finish.mutate()} ending={finish.isPending} finishError={finish.error} recover={() => void refetch()} commit={commit}
    warmUp={warmUp} warmUpAnswer={state?.warmUpAnswer} completeWarmUp={answer =>
      navigate(path(id), { replace: true, state: { ...state, warmUpAnswer: answer } })}
    readAloud={state?.readAloud !== false} announceWelcome={!interview.turns.length && state?.warmUpAnswer === undefined}
    autoListen={autoListen} setAutoListen={setAutoListen} panel={panel} setPanel={setPanel} captions={captions} setCaptions={setCaptions} />;
}

function AnswerReview({ turn, feedback, pending }: { turn: Turn; feedback?: AnswerFeedback; pending: boolean }) {
  return <article className="qa review-answer">
    <h3 className="q">{turn.question.text}</h3>
    <p className="a">{turn.answer ?? 'Skipped'}</p>
    {feedback ? <>
      {feedback.grades.length ? <div className="evidence-list">{feedback.grades.map(grade => {
        const visible = turn.answer?.slice(grade.evidence.start, grade.evidence.end);
        if (visible !== grade.evidence.quote) return null;
        return <div className="evidence" key={grade.dimension} id={'evidence-' + turn.id + '-' + grade.dimension}>
          <div><strong>{label[grade.dimension]}</strong><span>{grade.score}/4</span></div>
          <blockquote>{visible}</blockquote><p>{grade.rationale}</p>
        </div>;
      })}</div> : <p className="form-hint">No rubric score could be assigned to this answer.</p>}
      <div className="coach-notes">
        {feedback.strengths.length > 0 && <div><strong>Strengths</strong><ul>{feedback.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {feedback.improvements.length > 0 && <div><strong>What to improve</strong><ul>{feedback.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      </div>
    </> : <p className="form-hint">{pending ? 'Feedback for this answer is pending.' : 'Feedback is unavailable for this answer.'}</p>}
  </article>;
}

function downloadTranscript(session: InterviewSession, report?: InterviewReport, warmUpAnswer?: string) {
  const transcript = [
    interviewerName + ' interview transcript',
    trackLabels[session.track] + ' · ' + (session.role ?? 'General practice') + ' · ' + session.difficulty,
    'Score: ' + (report?.overall == null ? 'Unavailable' : report.overall + '/100'),
    '',
    ...(warmUpAnswer ? ['Warm-up: ' + openingQuestion(session.role), 'A: ' + warmUpAnswer, ''] : []),
    ...session.turns.map((turn, index) => 'Q' + (index + 1) + ': ' + turn.question.text + '\nA: ' + (turn.answer ?? '(skipped)') + '\n'),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([transcript], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sadhana-ai-interview-transcript.txt';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportPage() {
  const id = useParams().id ?? '';
  const { state } = useLocation();
  const interview = useInterview(id);
  const cache = useQueryClient();
  const reportKey = ['report', id];
  const report = useQuery({
    queryKey: reportKey, queryFn: () => api<InterviewReport>(path(id) + '/report'),
    enabled: interview.data?.status === 'completed',
    refetchInterval: state => ['queued', 'working'].includes(state.state.data?.status ?? '') ? 1500 : false,
  });
  const reportStatus = report.data?.status;
  useEffect(() => {
    if (reportStatus === 'ready' || reportStatus === 'partial') {
      for (const key of ['interviews', 'interview-history', 'trends']) void cache.invalidateQueries({ queryKey: [key] });
    }
  }, [reportStatus, cache]);
  const retry = useMutation({
    mutationFn: () => api<InterviewReport>(path(id) + '/report/retry', { method: 'POST' }),
    onSuccess: result => cache.setQueryData(reportKey, result),
  });
  if (interview.isPending) return <Loading label="Loading interview report…" />;
  if (interview.isError || !interview.data) return <ErrorNotice error={interview.error} retry={() => void interview.refetch()} />;
  const session = interview.data;
  if (session.status === 'active') return <Navigate to={path(id)} replace state={state} />;
  const result = report.data;
  const busy = result?.status === 'queued' || result?.status === 'working';
  const score = result?.overall ?? null;
  const rating = score === null ? 'Score pending' : score >= 80 ? 'Excellent' : score >= 65 ? 'Good'
    : score >= 45 ? 'Getting there' : 'Needs practice';
  const metrics = interviewMetrics(session.turns);
  const warmUpAnswer = typeof state?.warmUpAnswer === 'string' ? state.warmUpAnswer : undefined;
  const improvements = [...new Set(result?.answers.flatMap(answer => answer.improvements) ?? [])].slice(0, 3);
  const settings = {
    track: session.track, difficulty: session.difficulty, minutes: String(session.minutes),
    analysis: typeof state?.analysisId === 'string' ? state.analysisId : undefined,
  };
  return <div className="interview-meet"><div className="modal meet-summary">
    <section className="sum meet-report-card" aria-labelledby="meet-report-title">
      <h1 id="meet-report-title">Interview summary</h1>
      <p className="sub">{trackLabels[session.track]} · {session.role ?? 'General practice'} · <span className="meet-title-case">{session.difficulty}</span></p>
      <div className="top">
        <div className="ring" style={{ background: 'conic-gradient(var(--blue) ' + (score ?? 0) + '%, #e1e5ea 0)' }}>
          <div><span>{score ?? '—'}<small>{score === null && !busy && !report.isPending ? 'Unscored' : rating}</small></span></div>
        </div>
        <div className="stats">
          <div><b>{session.covered}/{session.planned}</b><span>Questions covered</span></div>
          <div><b>{metrics.average}</b><span>Avg. words per answer</span></div>
          <div><b>{metrics.fillers}</b><span>Filler words</span></div>
          <div><b>{session.minutes} min</b><span>Session duration</span></div>
        </div>
      </div>
      <ErrorNotice error={report.error ?? retry.error} retry={report.isError ? () => void report.refetch() : undefined} />
      {(report.isPending || busy) && <div className="qa"><Loading label="Preparing feedback for your saved answers…" /></div>}
      {improvements.length > 0 && <div className="qa meet-focus"><h2 className="q">Focus for next time</h2>
        {improvements.map(point => <p key={point}>• {point}</p>)}</div>}
      {result && <div className="qa"><p>{result.graded} of {result.attempted} submitted answers received a rubric score.</p>
        <p>{providerLabel[result.provider]} · {result.rubric}</p>
        <details><summary>Scoring dimensions</summary>
          {result.dimensions.map(row => {
            const first = result.answers.find(answer => answer.grades.some(grade => grade.dimension === row.dimension));
            return <div key={row.dimension} className="meet-report-dimension">
              {first ? <a href={'#evidence-' + first.turnId + '-' + row.dimension}>{label[row.dimension]}</a> : <span>{label[row.dimension]}</span>}
              <strong>{row.score === null ? 'Unscored' : row.score + '%'}</strong>
            </div>;
          })}
        </details>
        {(result.status === 'partial' || result.status === 'failed') && <p>Feedback could not be prepared for {result.failed} {result.failed === 1 ? 'answer' : 'answers'}.
          <button className="btn s" onClick={() => retry.mutate()} disabled={retry.isPending}>Retry feedback</button></p>}
      </div>}
      {session.turns.map(turn => <AnswerReview key={turn.id} turn={turn}
        feedback={result?.answers.find(item => item.turnId === turn.id)} pending={report.isPending || busy} />)}
      {warmUpAnswer && <div className="qa"><h2 className="q">Warm-up answer</h2><p className="a">{warmUpAnswer}</p></div>}
      {!session.turns.length && !warmUpAnswer && <div className="qa"><p>No answers submitted.</p></div>}
      <div className="sum-actions">
        <Link to="/history" className="btn s">Exit</Link>
        <button type="button" className="btn s" onClick={() => downloadTranscript(session, result, warmUpAnswer)}>Download transcript</button>
        <Link className="btn s" to={'/interviews/new' + queryString({ ...settings, lobby: '1' })}>Back to lobby</Link>
        <Link className="btn p" to={'/interviews/new' + queryString(settings)}>Practice again</Link>
      </div>
    </section>
  </div></div>;
}
