import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Turn } from '../../../shared/contracts.ts';
import { useInterviewCamera } from '../features/voice/interview-media.tsx';
import { useSession } from '../services/session.tsx';
import { BrandMark } from './ui.tsx';
import './interview-room.css';

export const interviewerName = 'Sadhana AI';
export const meetBackgrounds = [
  ['None', ''],
  ['Sunset', 'linear-gradient(135deg,#ff9966,#ff5e62)'],
  ['Ocean', 'linear-gradient(135deg,#2193b0,#6dd5ed)'],
  ['Forest', 'linear-gradient(135deg,#134e5e,#71b280)'],
  ['Midnight', 'linear-gradient(135deg,#232526,#414345)'],
] as const;

export function MeetIcon({ name }: { name: string }) {
  return <span className="ms" aria-hidden>{name}</span>;
}

export function MeetIconButton({ icon, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return <button type="button" aria-label={label} title={label} {...props}><MeetIcon name={icon} /></button>;
}

export function InterviewIdentity() {
  return <div className="brand"><span className="meet-brand-mark"><BrandMark /></span><span>{interviewerName}</span></div>;
}

export function CandidatePreview({ compact = false, muted = true, hand = false, children }: {
  compact?: boolean; muted?: boolean; hand?: boolean; children?: ReactNode;
}) {
  const { user } = useSession();
  const { stream, mirror, background } = useInterviewCamera();
  const video = useRef<HTMLVideoElement>(null);
  const name = user?.name ?? 'You';
  useEffect(() => {
    const element = video.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    return () => { element.srcObject = null; };
  }, [stream]);

  return <div className={compact ? 'tile self' : 'preview'}>
    {compact && <div className="self-bg" style={background ? { background } : undefined} />}
    {stream
      ? <video ref={video} muted autoPlay playsInline className={mirror ? 'mirror' : undefined} aria-label="Your local camera preview" />
      : compact ? <div className="s-av" aria-hidden><div>{name.trim().slice(0, 1).toUpperCase()}</div></div>
        : <div className="pv-off"><div className="pv-bg" style={background ? { background } : undefined} /><span>Camera is off</span></div>}
    <span className={compact ? 'tile-name' : 'pv-name'}>{name}</span>
    {compact && muted && <div className="badge" title="Microphone off"><MeetIcon name="mic_off" /></div>}
    {compact && hand && <div className="hand-b meet-hand" title="Hand raised"><MeetIcon name="back_hand" /></div>}
    {children}
  </div>;
}

export function CameraButton({ className }: { className?: string }) {
  const { stream, pending, start, stop } = useInterviewCamera();
  const label = pending ? 'Opening camera…' : stream ? 'Turn off camera' : 'Turn on camera';
  return <MeetIconButton className={className} disabled={pending} label={label} icon={stream ? 'videocam' : 'videocam_off'}
    onClick={() => stream ? stop() : void start()} />;
}

export type MeetMenuAnchor = { name: string; element: HTMLButtonElement; above?: boolean };

export function MeetMenu({ anchor, close, dark = false, children }: {
  anchor: MeetMenuAnchor; close: () => void; dark?: boolean; children: ReactNode;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = menu.current!;
    function place() {
      const target = anchor.element.getBoundingClientRect();
      const left = Math.min(window.innerWidth - element.offsetWidth - 8, Math.max(8, target.left));
      const below = target.bottom + 7;
      const above = target.top - element.offsetHeight - 7;
      const top = anchor.above || below + element.offsetHeight > window.innerHeight - 8 ? above : below;
      element.style.left = Math.max(8, left) + 'px';
      element.style.top = Math.max(8, top) + 'px';
    }
    place();
    element.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [anchor]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !anchor.element.contains(event.target)) close();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
      anchor.element.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor, close]);

  return <div ref={menu} className={'menu' + (dark ? ' dark' : '')}>{children}</div>;
}

type DeviceKind = 'audioinput' | 'audiooutput' | 'videoinput';
const deviceLabels: Record<DeviceKind, string> = { audioinput: 'Microphone', audiooutput: 'Speakers', videoinput: 'Camera' };

export function DeviceChoices({ kind, close }: { kind: DeviceKind; close: () => void }) {
  const [options, setOptions] = useState<MediaDeviceInfo[]>([]);
  const { devices, selectDevice } = useInterviewCamera();
  const name = deviceLabels[kind];
  useEffect(() => {
    let active = true;
    void navigator.mediaDevices?.enumerateDevices().then(list => {
      if (active) setOptions(list.filter(device => device.kind === kind && device.deviceId && device.deviceId !== 'default'));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [kind]);
  return <>
    <div className="hd">{name}</div>
    {[{ deviceId: '', label: name + ' (Default)' }, ...options].map(({ deviceId, label }, index) =>
      <button type="button" className="it" key={deviceId} onClick={() => { selectDevice(kind, deviceId); close(); }}>
        <span className="t">{label || name + ' ' + index}</span>
        {devices[kind] === deviceId && <MeetIcon name="check" />}
      </button>)}
    {kind === 'audiooutput' && <p className="tip">Question speech uses your system’s audio output. This selection applies to recorded answers.</p>}
  </>;
}

export function BackgroundChoices({ close }: { close: () => void }) {
  const { setBackground, background } = useInterviewCamera();
  return <>
    <div className="hd">Backgrounds</div>
    {meetBackgrounds.map(([name, value]) =>
      <button type="button" key={name} className="it" onClick={() => { setBackground(value); close(); }}>
        <span className="sw" style={value ? { background: value } : undefined} />
        <span className="t">{name}</span>
        {background === value && <MeetIcon name="check" />}
      </button>)}
  </>;
}

export function interviewMetrics(turns: Turn[]) {
  const answers = turns.flatMap(turn => turn.answer ? [turn.answer] : []);
  const count = answers.length;
  const words = answers.reduce((total, answer) => total + (answer.match(/\S+/g)?.length ?? 0), 0);
  const fillers = answers.reduce((total, answer) => total + (answer.match(/\b(?:um|uh|erm|you know|like)\b/gi)?.length ?? 0), 0);
  return { count, average: count ? Math.round(words / count) : 0, fillers };
}
