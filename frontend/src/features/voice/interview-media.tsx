import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

type InterviewCamera = {
  stream: MediaStream | null;
  pending: boolean;
  error: string;
  start(deviceId?: string): Promise<void>;
  stop(): void;
  devices: { audioinput: string; audiooutput: string; videoinput: string };
  selectDevice(kind: 'audioinput' | 'audiooutput' | 'videoinput', id: string): void;
  background: string;
  setBackground(value: string): void;
  mirror: boolean;
  setMirror(value: boolean): void;
};
const CameraContext = createContext<InterviewCamera | null>(null);

export function InterviewMediaLayout() {
  const { pathname } = useLocation();
  const current = useRef<MediaStream | null>(null);
  const request = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState({ audioinput: '', audiooutput: '', videoinput: '' });
  const [background, setBackground] = useState('');
  const [mirror, setMirror] = useState(true);

  const release = useCallback(() => {
    request.current++;
    current.current?.getTracks().forEach(track => track.stop());
    current.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setStream(null);
    setPending(false);
    setError('');
  }, [release]);

  useEffect(() => release, [release]);
  useEffect(() => {
    if (pathname === '/interviews/new') stop();
  }, [pathname, stop]);

  async function start(deviceId = devices.videoinput) {
    if (current.current || pending) return;
    const id = ++request.current;
    setPending(true);
    setError('');
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false });
      if (id !== request.current) {
        next.getTracks().forEach(track => track.stop());
        return;
      }
      current.current = next;
      setStream(next);
      for (const track of next.getVideoTracks()) {
        track.addEventListener('ended', () => { if (current.current === next) stop(); }, { once: true });
      }
    } catch {
      if (id === request.current) setError('Camera access is unavailable. You can continue with it off.');
    } finally {
      if (id === request.current) setPending(false);
    }
  }

  function selectDevice(kind: keyof typeof devices, id: string) {
    setDevices(previous => ({ ...previous, [kind]: id }));
    if (kind === 'videoinput' && stream && !pending && id !== devices.videoinput) {
      stop();
      void start(id);
    }
  }

  return <CameraContext.Provider value={{ stream, pending, error, start, stop, devices, selectDevice, background, setBackground, mirror, setMirror }}>
    <Outlet />
  </CameraContext.Provider>;
}

export function useInterviewCamera() {
  const camera = useContext(CameraContext);
  if (!camera) throw new Error('InterviewMediaLayout is required');
  return camera;
}
