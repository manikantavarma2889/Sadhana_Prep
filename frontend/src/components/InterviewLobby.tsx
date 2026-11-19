import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { difficulties, durations, interviewQuestionCounts, trackLabels, tracks, type InterviewSettings } from '../../../shared/contracts.ts';
import { createSpokenPrompt } from '../features/voice/browser-speech.ts';
import { prepareCaptions } from '../features/voice/local-captions.ts';
import { useInterviewCamera } from '../features/voice/interview-media.tsx';
import { useSession } from '../services/session.tsx';
import {
  BackgroundChoices, CameraButton, CandidatePreview, DeviceChoices, InterviewIdentity, MeetIcon, MeetIconButton, MeetMenu,
  interviewerName, meetBackgrounds, type MeetMenuAnchor,
} from './InterviewMedia.tsx';
import { ErrorNotice } from './ui.tsx';

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function InterviewLobby({ join, back, pending, error, settings, update, roleTitle, readAloud, setReadAloud }: {
  join: () => void; back: () => void; pending: boolean; error: unknown; settings: InterviewSettings;
  update: (settings: InterviewSettings) => void; roleTitle?: string; readAloud: boolean; setReadAloud: (enabled: boolean) => void;
}) {
  const { user } = useSession();
  const camera = useInterviewCamera();
  const modal = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const optionsId = useId();
  const [menu, setMenu] = useState<MeetMenuAnchor | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [clock, setClock] = useState(() => clockFormat.format());
  const [notice, setNotice] = useState('');
  const [microphoneTest, setMicrophoneTest] = useState(false);

  useEffect(() => {
    const element = modal.current!;
    element.showModal();
    const timer = window.setInterval(() => setClock(clockFormat.format()), 15_000);
    return () => {
      element.close();
      window.clearInterval(timer);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openMenu(name: string, event: MouseEvent<HTMLButtonElement>) {
    const element = event.currentTarget;
    setMenu(previous => previous?.element === element ? null : { name, element });
  }

  function leave() {
    if (pending) return;
    camera.stop();
    back();
  }

  async function testMicrophone() {
    setMicrophoneTest(true);
    try {
      const deviceId = camera.devices.audioinput;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
      stream.getTracks().forEach(track => track.stop());
      setNotice('Microphone is available.');
    } catch {
      setNotice('Microphone access is unavailable. You can type your answers.');
    } finally {
      setMicrophoneTest(false);
    }
  }

  function testSpeakers() {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setNotice('Speaker preview is unavailable in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const prompt = createSpokenPrompt('This is ' + interviewerName + '. Your speakers are working.');
    prompt.onerror = event => { if (event.error !== 'canceled') setNotice('Speaker preview is unavailable. Check your audio output.'); };
    window.speechSynthesis.speak(prompt);
  }

  function joinInterview() {
    if (user?.voiceEnabled) {
      void prepareCaptions().catch(() => undefined);
      window.speechSynthesis?.getVoices();
    }
    join();
  }

  const close = () => setMenu(null);
  const background = meetBackgrounds.find(([, value]) => value === camera.background)?.[0];
  return <div className="interview-meet">
    <dialog className="meet-lobby" aria-labelledby={titleId} ref={modal} onCancel={event => { event.preventDefault(); leave(); }}>
      <header className="lobby-top">
        <InterviewIdentity />
        <div className="right"><time>{clock}</time><span className="avatar-top" aria-hidden>{user?.name.trim().slice(0, 1).toUpperCase()}</span></div>
      </header>
      <div className="lobby-main">
        <div className="lobby-left">
          <CandidatePreview>
            <MeetIconButton className="pv-more" icon="more_vert" label="More options" onClick={event => openMenu('options', event)} />
            <MeetIconButton className="pv-dots" icon="more_horiz" label="Practice tips" onClick={event => openMenu('tips', event)} />
            <div className="pv-controls">
              {user?.voiceEnabled && <MeetIconButton className="pv-btn mic-btn" icon="mic" label="Test microphone" disabled={microphoneTest}
                onClick={() => void testMicrophone()} />}
              <CameraButton className={'pv-btn cam-btn' + (camera.stream ? '' : ' off')} />
              <MeetIconButton className="pv-btn fx" icon="auto_awesome_mosaic" label="Visual effects" onClick={event => openMenu('background', event)} />
            </div>
          </CandidatePreview>
          <div className="pills">
            {user?.voiceEnabled && <>
              <button className="device-pill" type="button" onClick={event => openMenu('audioinput', event)}>
                <MeetIcon name="mic" /><span className="lbl">Microphone{camera.devices.audioinput ? '' : ' (Default)'}</span><MeetIcon name="arrow_drop_down" />
              </button>
              <button className="device-pill" type="button" onClick={event => openMenu('audiooutput', event)}>
                <MeetIcon name="volume_up" /><span className="lbl">Speakers{camera.devices.audiooutput ? '' : ' (Default)'}</span><MeetIcon name="arrow_drop_down" />
              </button>
            </>}
            <button className="device-pill" type="button" onClick={event => openMenu('videoinput', event)}>
              <MeetIcon name="videocam" /><span className="lbl">Camera{camera.devices.videoinput ? '' : ' (Default)'}</span><MeetIcon name="arrow_drop_down" />
            </button>
            <button className="device-pill" type="button" onClick={event => openMenu('background', event)}>
              <MeetIcon name="wallpaper" /><span className="lbl">{camera.background ? background : 'Backgrounds'}</span><MeetIcon name="arrow_drop_down" />
            </button>
          </div>
          {camera.error && <p className="meet-device-error" role="status">{camera.error}</p>}
        </div>
        <section className="lobby-right">
          <h1 id={titleId}>Ready to join?</h1>
          <button className="join-btn" type="button" disabled={pending} onClick={joinInterview}>
            {pending ? <><span className="spin" aria-hidden />Asking to join…</> : 'Ask to join'}
          </button>
          <button className={'other-btn' + (showOptions ? ' open' : '')} type="button" aria-expanded={showOptions} aria-controls={optionsId}
            onClick={() => setShowOptions(value => !value)}>Other ways to join <MeetIcon name="expand_more" /></button>
          <div id={optionsId} className="options" hidden={!showOptions}>
            <label>Interview type<select value={settings.track} disabled={pending}
              onChange={event => update({ ...settings, track: event.target.value as InterviewSettings['track'] })}>
              {tracks.map(track => <option key={track} value={track}>{trackLabels[track]}</option>)}
            </select></label>
            <label>Target role<input type="text" value={roleTitle ?? 'General practice'} readOnly /></label>
            <div className="row">
              <label>Level<select value={settings.difficulty} disabled={pending}
                onChange={event => update({ ...settings, difficulty: event.target.value as InterviewSettings['difficulty'] })}>
                {difficulties.map(level => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}
              </select></label>
              <label>Duration<select value={settings.minutes} disabled={pending}
                onChange={event => update({ ...settings, minutes: Number(event.target.value) as InterviewSettings['minutes'] })}>
                {durations.map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select></label>
            </div>
            <div>{interviewQuestionCounts[settings.minutes]} planned questions</div>
            {user?.voiceEnabled && <label className="chk"><input type="checkbox" checked={readAloud} disabled={pending}
              onChange={event => setReadAloud(event.target.checked)} /> Let {interviewerName} speak questions aloud</label>}
            <button type="button" className="lobby-back" onClick={leave} disabled={pending}>Back to setup</button>
          </div>
          <div className="sumline"><MeetIcon name="smart_toy" /><span>{interviewerName} is ready</span></div>
          <ErrorNotice error={error} />
        </section>
      </div>
      {menu && <MeetMenu anchor={menu} close={close}>
        {menu.name === 'background' && <BackgroundChoices close={close} />}
        {(menu.name === 'audioinput' || menu.name === 'audiooutput' || menu.name === 'videoinput') &&
          <DeviceChoices kind={menu.name} close={close} />}
        {menu.name === 'audiooutput' && <button className="it" type="button" onClick={() => { close(); testSpeakers(); }}>
          <MeetIcon name="volume_up" /> Test speakers
        </button>}
        {menu.name === 'options' && <>
          <button type="button" className="it" onClick={() => { camera.setMirror(!camera.mirror); close(); }}>
            <MeetIcon name="videocam" /> {camera.mirror ? 'Unmirror camera' : 'Mirror camera'}
          </button>
          <button type="button" className="it" disabled={pending} onClick={leave}>Back to setup</button>
        </>}
        {menu.name === 'tips' && <>
          <p className="tip"><MeetIcon name="mic" /> Test your microphone before joining.</p>
          <p className="tip"><MeetIcon name="chat" /> You can answer aloud or type in chat.</p>
          <p className="tip"><MeetIcon name="settings" /> Open Other ways to join to review your session.</p>
        </>}
      </MeetMenu>}
      {notice && <div className="meet-toast show" role="status">{notice}</div>}
    </dialog>
  </div>;
}
