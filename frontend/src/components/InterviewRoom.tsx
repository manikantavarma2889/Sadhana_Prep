import { useCallback, useEffect, useEffectEvent, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { difficultyLabels, trackLabels, type InterviewSession, type Question } from '../../../shared/contracts.ts';
import { openingQuestion } from '../../../shared/interview-opening.ts';
import { useInterviewCamera } from '../features/voice/interview-media.tsx';
import { useVoice } from '../features/voice/useVoice.ts';
import { api, ApiError } from '../services/api.ts';
import { useSession } from '../services/session.tsx';
import { BrandMark, ErrorNotice } from './ui.tsx';
import {
  BackgroundChoices, CameraButton, CandidatePreview, DeviceChoices, MeetIcon, MeetIconButton, MeetMenu,
  interviewMetrics, interviewerName, type MeetMenuAnchor,
} from './InterviewMedia.tsx';

type Submission = { questionId: string; expectedRevision: number; action: 'answer'; text: string } |
  { questionId: string; expectedRevision: number; action: 'skip' };
export type InterviewPanel = 'chat' | 'activities' | null;

const reactions = [['👍', 'Thumbs up'], ['👏', 'Applause'], ['🎉', 'Celebrate'], ['❤️', 'Heart'], ['😂', 'Laugh']] as const;

function timeLabel(seconds: number) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

function Message({ name, text }: { name?: string; text: string }) {
  return <div className={'msg' + (name ? '' : ' sys')}>{name && <div className="who"><b>{name}</b></div>}<div className="tx">{text}</div></div>;
}

export function InterviewRoom({ interview, question, seconds, expired, end, ending, finishError, recover, commit, readAloud, announceWelcome,
  warmUp, warmUpAnswer, completeWarmUp, autoListen, setAutoListen, panel, setPanel, captions, setCaptions }: {
  interview: InterviewSession; question: Question; seconds: number | null; expired: boolean;
  end: () => void; ending: boolean; finishError: unknown; recover: () => void; commit: (next: InterviewSession) => void;
  readAloud: boolean; announceWelcome: boolean; warmUp: boolean; warmUpAnswer?: string | null; completeWarmUp: (answer: string | null) => void;
  autoListen: boolean; setAutoListen: (enabled: boolean) => void; panel: InterviewPanel; setPanel: (panel: InterviewPanel) => void;
  captions: boolean; setCaptions: (enabled: boolean) => void;
}) {
  const { user } = useSession();
  const camera = useInterviewCamera();
  const voiceEnabled = Boolean(user?.voiceEnabled);
  const speechOptions = useQuery({
    queryKey: ['speech-options'], queryFn: () => api<{ transcription: boolean; verifyTranscript?: boolean }>('/speech/options'),
    enabled: voiceEnabled, retryOnMount: false, staleTime: 5 * 60_000,
  });
  const backupEnabled = speechOptions.data?.transcription === true;
  const verifyTranscript = speechOptions.data?.verifyTranscript === true;
  const transcribe = useCallback(async (audio: Blob) => {
    const payload = new FormData();
    payload.set('audio', audio, 'answer');
    const result = await api<{ text: string }>('/interviews/' + interview.id + '/transcription', { method: 'POST', body: payload });
    return result.text;
  }, [interview.id, verifyTranscript]);
  const voice = useVoice(backupEnabled ? transcribe : undefined, verifyTranscript);
  const { speak, stopSpeaking } = voice;
  const canSpeak = voiceEnabled && typeof window.SpeechSynthesisUtterance === 'function';
  const candidate = user?.name?.trim() || 'there';
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'introduction' | 'question' | 'answer'>(() =>
    readAloud && canSpeak ? announceWelcome ? 'introduction' : 'question' : 'answer');
  const [welcomeDelivered, setWelcomeDelivered] = useState(!announceWelcome || !readAloud || !canSpeak);
  const [questionDelivered, setQuestionDelivered] = useState(!readAloud || !canSpeak);
  const [needsPlayback, setNeedsPlayback] = useState(() => navigator.userActivation?.hasBeenActive === false);
  const [menu, setMenu] = useState<MeetMenuAnchor | null>(null);
  const [hand, setHand] = useState(false);
  const [toast, setToast] = useState('');
  const [effects, setEffects] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const nextEffect = useRef(0);
  const chat = useRef<HTMLDivElement>(null);
  const liveCaption = useRef<HTMLDivElement>(null);
  const submission = useRef<{ input: string; key: string } | null>(null);
  const completingVoice = useRef(false);
  const playback = useRef(0);
  const welcomeRead = useRef(false);
  const recording = voice.status === 'recording';
  const finishingVoice = voice.status === 'finishing';
  const answeredPrompts = interview.turns.filter(turn => !turn.question.followUp).length;
  const index = Math.min(interview.planned, answeredPrompts + (question.followUp ? 0 : 1));
  const spokenPrompt = (question.followUp ? 'Follow-up. ' : 'Question ' + index + '. ') + question.text;
  const welcome = 'Hi ' + candidate + ', I’m Sadhana, your AI interviewer. Today is a ' +
    trackLabels[interview.practiceTrack ?? interview.track].toLowerCase() + ' practice' +
    (interview.role && interview.track !== 'practice' ? ' for the ' + interview.role + ' position' : '') +
    ' at ' + difficultyLabels[interview.difficulty].toLowerCase() + ' level. ' +
    (interview.timeBased ? 'We’ll practice for ' + interview.minutes + ' minutes, with questions based on your resume and selected track. ' : 'We’ll go through ' + interview.planned + ' questions. ') +
    'Answer out loud or type in the chat, and press Done answering when you finish.';
  const remaining = Math.min(interview.minutes * 60, Math.max(0, seconds ?? interview.minutes * 60));
  const elapsed = interview.minutes * 60 - remaining;
  const metrics = interviewMetrics(interview.turns);
  const voiceError = voice.error || voice.playbackError;
  const interviewerSpeaking = phase !== 'answer';
  const answer = useMutation({
    mutationFn: (body: Submission) => {
      const input = JSON.stringify(body);
      if (submission.current?.input !== input) submission.current = { input, key: crypto.randomUUID() };
      return api<InterviewSession>('/interviews/' + interview.id + '/answers', {
        method: 'POST', body, idempotencyKey: submission.current.key,
      });
    },
    onSuccess: commit,
  });

  async function speakTurn() {
    const turn = ++playback.current;
    const active = () => turn === playback.current;
    setNeedsPlayback(false);
    if (announceWelcome && !welcomeRead.current) {
      setPhase('introduction');
      const completed = await speak(welcome);
      if (!active()) return;
      if (!completed) { setNeedsPlayback(true); return; }
      welcomeRead.current = true;
      setWelcomeDelivered(true);
    }
    setPhase('question');
    const heard = await speak(spokenPrompt);
    if (!active()) return;
    if (!heard) { setNeedsPlayback(true); return; }
    setQuestionDelivered(true);
    setPhase('answer');
    if (!autoListen || !voice.canRecord || expired) return;
    if (window.matchMedia('(max-width: 760px)').matches) setPanel(null);
    void voice.start(camera.devices.audioinput);
  }

  const announceTurn = useEffectEvent(speakTurn);
  useEffect(() => {
    if (!readAloud || !canSpeak || expired || navigator.userActivation?.hasBeenActive === false) return;
    const frame = window.requestAnimationFrame(() => { void announceTurn(); });
    return () => {
      playback.current++;
      window.cancelAnimationFrame(frame);
      stopSpeaking();
    };
  }, [readAloud, canSpeak, expired, question.id, stopSpeaking]);

  useEffect(() => {
    if (panel === 'chat' && chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [panel, question.id, interview.turns.length, welcomeDelivered, questionDelivered]);

  useEffect(() => {
    if (liveCaption.current) liveCaption.current.scrollTop = liveCaption.current.scrollHeight;
  }, [voice.transcript]);

  useEffect(() => {
    if (voice.error.startsWith('Microphone access is unavailable')) setPanel('chat');
  }, [voice.error, setPanel]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openMenu(name: string, event: MouseEvent<HTMLButtonElement>) {
    const element = event.currentTarget;
    setMenu(previous => previous?.element === element ? null : { name, element, above: true });
  }

  function interruptPlayback() {
    playback.current++;
    stopSpeaking();
  }

  function submitText(text: string) {
    const answerText = text.trim().slice(0, 8000);
    if (!answerText || interviewerSpeaking || answer.isPending || expired || ending) return;
    interruptPlayback();
    if (warmUp) completeWarmUp(answerText);
    else answer.mutate({ questionId: question.id, expectedRevision: interview.revision, action: 'answer', text: answerText });
  }

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!draft.trim() || interviewerSpeaking || finishingVoice || completingVoice.current || ending || expired || answer.isPending) return;
    interruptPlayback();
    completingVoice.current = true;
    try {
      if (voice.status !== 'idle') await voice.stop(false);
      submitText(draft);
    } finally {
      completingVoice.current = false;
    }
  }

  async function finishVoice(submit: boolean) {
    if (completingVoice.current || ending) return;
    completingVoice.current = true;
    try {
      const { text, complete } = await voice.stop();
      if (!text) {
        if (submit) {
          setToast('Speak your answer, then select Done answering.');
          void voice.start(camera.devices.audioinput);
        }
        return;
      }
      setPanel('chat');
      const combined = [draft.trim(), text].filter(Boolean).join('\n').slice(0, 8000);
      setDraft(combined);
      if (submit && complete) submitText(combined);
    } finally {
      completingVoice.current = false;
    }
  }

  function skip() {
    if (answer.isPending || expired || ending || finishingVoice) return;
    interruptPlayback();
    if (recording) void voice.stop(false);
    if (warmUp) completeWarmUp(null);
    else answer.mutate({ questionId: question.id, expectedRevision: interview.revision, action: 'skip' });
  }

  function microphone() {
    if (interviewerSpeaking || answer.isPending || ending || expired) return;
    if (recording) {
      setAutoListen(false);
      void finishVoice(false);
    } else if (!finishingVoice) {
      setAutoListen(true);
      interruptPlayback();
      if (window.matchMedia('(max-width: 760px)').matches) setPanel(null);
      void voice.start(camera.devices.audioinput);
    }
  }

  function leaveInterview() {
    interruptPlayback();
    if (recording) void voice.stop(false);
    end();
  }

  function react(emoji: string) {
    const id = ++nextEffect.current;
    setEffects(previous => [...previous.slice(-7), { id, emoji, left: 15 + Math.floor(Math.random() * 68) }]);
    setMenu(null);
  }

  const close = () => setMenu(null);
  async function play() {
    if (finishingVoice || voice.status === 'requesting' || answer.isPending || ending || expired || completingVoice.current) return;
    if (recording) {
      completingVoice.current = true;
      try {
        const { text } = await voice.stop(false);
        if (text) setDraft(previous => [previous.trim(), text].filter(Boolean).join('\n').slice(0, 8000));
      } finally {
        completingVoice.current = false;
      }
    }
    await speakTurn();
  }
  const togglePanel = (target: InterviewPanel) => setPanel(panel === target ? null : target);
  const readyToFinish = recording || (voice.status === 'idle' && Boolean(voice.transcript) && !draft && !answer.isPending);
  const statuses = ending ? 'Opening interview summary…' : finishingVoice ? verifyTranscript ? 'Checking your final transcript…' : 'Finishing your transcript…'
    : recording ? 'Your turn — listening…' : answer.isPending ? interviewerName + ' is thinking…'
    : voice.status === 'requesting' ? 'Preparing your microphone…'
    : interviewerSpeaking ? interviewerName + (phase === 'introduction' ? ' is introducing the session…' : ' is asking…') : 'Your turn to answer';
  return <div className="interview-meet">
    <section className="meet-call" aria-label={interviewerName + ' interview'}>
      <div className="call-body">
        <div className="stage">
          <div className={'tile main' + (voice.speaking ? ' speaking' : answer.isPending ? ' thinking' : '')}>
            <div className="qpill"><MeetIcon name="quiz" /><span>{warmUp ? 'Warm-up' : 'Question ' + index + (interview.timeBased ? '' : ' of ' + interview.planned)}</span>
              {question.followUp && <span className="follow-up-chip">Follow-up</span>}
            </div>
            <div className={'status' + (recording ? ' user' : answer.isPending ? ' think' : voice.speaking ? ' ai' : '') +
              (readyToFinish || needsPlayback && canSpeak ? '' : ' noact')}>
              <span className="dot" aria-hidden /><span>{expired ? 'Time is up. Opening your saved results.' : statuses}</span>
              {readyToFinish && !ending && <button className="done-btn" type="button" onClick={() => void finishVoice(true)}>Done answering</button>}
              {needsPlayback && canSpeak && !expired && !ending && <button className="done-btn" type="button"
                disabled={finishingVoice || voice.status === 'requesting' || answer.isPending} onClick={() => void play()}>Play question</button>}
            </div>
            <div className="orb-wrap"><div className="orb"><span className="meet-orb-mark"><BrandMark /></span></div></div>
            <div className="badge" aria-hidden><div className="bars"><i /><i /><i /></div></div>
            {captions && (recording || finishingVoice) ? <div className="captions meet-live-caption" ref={liveCaption}>
              <b>{candidate}</b><span>{voice.transcript || (finishingVoice ? 'Finishing your transcript…' : 'Listening…')}</span>
              <h1 className="meet-screen-reader">{spokenPrompt}</h1>
            </div> : <div className={captions ? 'captions' : 'meet-screen-reader'}>
              <b>{interviewerName}</b><h1>{phase === 'introduction' ? welcome : spokenPrompt}</h1>
            </div>}
            <div className="tile-name">{interviewerName} · AI Interviewer</div>
            {effects.map(effect => <span className="fl" key={effect.id} style={{ left: effect.left + '%' }}
              onAnimationEnd={() => setEffects(previous => previous.filter(item => item.id !== effect.id))} aria-hidden>{effect.emoji}</span>)}
          </div>
          <CandidatePreview compact muted={!recording} hand={hand} />
          {panel !== 'chat' && Boolean(voiceError || answer.error || finishError) && <div className="meet-stage-error">
            <ErrorNotice error={voiceError ? new Error(voiceError) : answer.error ?? finishError}
              retry={answer.error instanceof ApiError && answer.error.status === 409 ? recover : undefined} />
          </div>}
        </div>
        {panel && <aside className="panel meet-panel" aria-label={panel === 'chat' ? 'In-call messages' : 'Activities'}>
          <div className="panel-h"><span>{panel === 'chat' ? 'In-call messages' : 'Activities'}</span>
            <MeetIconButton className="icon-b" icon="close" label="Close panel" onClick={() => setPanel(null)} /></div>
          {panel === 'chat' ? <>
            <p className="panel-note">{verifyTranscript
              ? 'Live captions are a draft. Done answering checks the full recording before sending your final text.'
              : 'Your words appear on the call while you speak. Select Done answering to send your answer here.'}</p>
            <div className="chat-list" ref={chat}>
              <Message text={interviewerName + ' (AI Interviewer) joined the call'} />
              {welcomeDelivered && <Message name={interviewerName} text={welcome} />}
              {warmUpAnswer !== undefined && <><Message name={interviewerName} text={openingQuestion(interview.role)} />
                <Message name={candidate} text={warmUpAnswer ?? 'Skipped'} /></>}
              {interview.turns.map((turn, turnIndex) => <div className="meet-turn" key={turn.id}>
                <Message name={interviewerName} text={(turn.question.followUp ? 'Follow-up. ' :
                  'Question ' + interview.turns.slice(0, turnIndex + 1).filter(item => !item.question.followUp).length + '. ') + turn.question.text} />
                <Message name={candidate} text={turn.answer ?? 'Skipped'} />
              </div>)}
              {questionDelivered && <Message name={interviewerName} text={spokenPrompt} />}
            </div>
            <div className="meet-chat-feedback">
              <ErrorNotice error={voiceError ? new Error(voiceError) : answer.error ?? finishError}
                retry={answer.error instanceof ApiError && answer.error.status === 409 ? recover : undefined} />
            </div>
            <form className="chat-form" onSubmit={event => void send(event)}>
              <textarea aria-label="Your answer" placeholder="Type your answer" rows={1} maxLength={8000} value={draft} disabled={expired}
                onChange={event => setDraft(event.target.value)} onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }} />
              <MeetIconButton type="submit" icon="send" label="Submit answer" disabled={interviewerSpeaking || expired || finishingVoice || ending || answer.isPending || !draft.trim()} />
            </form>
          </> : <div className="act-view">
            <div className="card"><h4>INTERVIEW</h4>
              <div className="kv"><span>Type</span><b>{trackLabels[interview.track]}</b></div>
              <div className="kv"><span>Role</span><b>{interview.role ?? 'General practice'}</b></div>
              <div className="kv"><span>Level</span><b>{difficultyLabels[interview.difficulty]}</b></div>
              <div className="kv"><span>Duration</span><b>{interview.minutes} minutes</b></div>
              <div className="prog" role="progressbar" aria-label={interview.timeBased ? 'Session time elapsed' : 'Questions covered'}
                aria-valuenow={interview.timeBased ? elapsed : interview.covered} aria-valuemax={interview.timeBased ? interview.minutes * 60 : interview.planned}>
                <i style={{ width: 100 * (interview.timeBased ? elapsed / (interview.minutes * 60) : interview.covered / interview.planned) + '%' }} /></div>
              <div className="meet-progress-label">{interview.timeBased ? interview.covered + ' questions answered · time-based session' : interview.covered + ' of ' + interview.planned + ' questions covered'}</div>
            </div>
            <div className="card"><h4>LIVE METRICS</h4>
              <div className="kv"><span>Answers given</span><b>{metrics.count}</b></div>
              <div className="kv"><span>Avg. words / answer</span><b>{metrics.average}</b></div>
              <div className="kv"><span>Filler words</span><b>{metrics.fillers}</b></div>
            </div>
            <div className="act-btns">
              <button type="button" disabled={!canSpeak || finishingVoice || expired} onClick={() => void play()}><MeetIcon name="replay" /> Repeat question</button>
              <button type="button" disabled={answer.isPending || expired} onClick={skip}><MeetIcon name="skip_next" /> Skip question</button>
            </div>
            <div className="card"><h4>TIPS</h4><ul className="tips">
              <li>{interview.track === 'behavioral' ? 'Use STAR: Situation, Task, Action, Result.' : 'Explain your assumptions and the trade-offs you considered.'}</li>
              <li>Quantify impact with numbers where you can.</li><li>Pause briefly before starting your answer.</li>
            </ul></div>
          </div>}
        </aside>}
      </div>
      <footer className="bar-wrap">
        <div className="bar-left"><span aria-label="Elapsed time">{timeLabel(elapsed)}</span><span className="sp" />
          <span aria-label="Time remaining" title="Time remaining">{timeLabel(remaining)}</span><span className="sp" />
          <span>prep-{interview.id.slice(0, 7)}</span></div>
        <div className="bar">
          {voiceEnabled && <div className={'split' + (recording ? '' : ' off')}>
            <MeetIconButton className="chev" icon="keyboard_arrow_up" label="Audio settings" onClick={event => openMenu('audioinput', event)} />
            <MeetIconButton className="cb mic-btn" icon={recording ? 'mic' : 'mic_off'} label={recording ? 'Stop recording' : 'Record answer'}
              disabled={interviewerSpeaking || answer.isPending || !voice.canRecord || voice.status === 'requesting' || finishingVoice || ending || expired} onClick={microphone} />
          </div>}
          <div className={'split' + (camera.stream ? '' : ' off')}>
            <MeetIconButton className="chev" icon="keyboard_arrow_up" label="Video settings" onClick={event => openMenu('videoinput', event)} />
            <CameraButton className="cb cam-btn" />
          </div>
          <MeetIconButton className="cb hide-sm" icon="present_to_all" label="Present"
            onClick={() => { setToast('Use the in-call messages to share code snippets.'); setPanel('chat'); }} />
          <MeetIconButton className="cb hide-sm" icon="mood" label="Reactions" onClick={event => openMenu('reactions', event)} />
          <MeetIconButton className={'cb' + (captions ? ' on' : '')} icon="closed_caption" label="Captions" aria-pressed={captions}
            onClick={() => setCaptions(!captions)} />
          <MeetIconButton className={'cb hide-sm' + (hand ? ' on' : '')} icon="back_hand" label={hand ? 'Lower hand' : 'Raise hand'}
            onClick={() => { setHand(!hand); setToast(hand ? 'Hand lowered' : 'You raised your hand'); }} />
          <MeetIconButton className="cb sq" icon="more_vert" label="More options" onClick={event => openMenu('more', event)} />
          <MeetIconButton className="cb end" icon="call_end" label="End interview" disabled={ending || answer.isPending || finishingVoice} onClick={leaveInterview} />
        </div>
        <div className="bar-right"><div className="grp">
          <MeetIconButton className={'cb' + (panel === 'chat' ? ' on' : '')} icon="chat" label="Chat" aria-pressed={panel === 'chat'}
            onClick={() => togglePanel('chat')} />
          <MeetIconButton className={'cb' + (panel === 'activities' ? ' on' : '')} icon="apps" label="Activities"
            aria-pressed={panel === 'activities'} onClick={() => togglePanel('activities')} />
        </div></div>
      </footer>
      {menu && <MeetMenu anchor={menu} close={close} dark>
        {(menu.name === 'audioinput' || menu.name === 'videoinput') && <DeviceChoices kind={menu.name} close={close} />}
        {menu.name === 'background' && <BackgroundChoices close={close} />}
        {menu.name === 'reactions' && <div className="emo">{reactions.map(([emoji, label]) =>
          <button type="button" key={emoji} aria-label={label} onClick={() => react(emoji)}>{emoji}</button>)}</div>}
        {menu.name === 'more' && <>
          <button className="it" type="button" disabled={!canSpeak || finishingVoice || expired} onClick={() => { void play(); close(); }}>
            <MeetIcon name="replay" /> Repeat question
          </button>
          {voice.speaking && <button className="it" type="button" onClick={() => { interruptPlayback(); setNeedsPlayback(true); close(); }}>Stop question playback</button>}
          <button className="it" type="button" disabled={answer.isPending || expired} onClick={() => { skip(); close(); }}>
            <MeetIcon name="skip_next" /> Skip question
          </button>
          <button className="it" type="button" onClick={() => setMenu({ ...menu, name: 'background' })}>
            <MeetIcon name="wallpaper" /> Backgrounds
          </button>
          <button className="it" type="button" onClick={() => { setToast(timeLabel(remaining) + ' remaining'); close(); }}>Time remaining</button>
        </>}
      </MeetMenu>}
      {(toast || camera.error) && <div className="meet-toast show" role="status">{toast || camera.error}</div>}
    </section>
  </div>;
}
