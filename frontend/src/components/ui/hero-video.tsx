import { useEffect, useRef, useSyncExternalStore } from 'react';
import { prismaHeroVideo } from '../../../../shared/hero-media.ts';

const reducedMotion = '(prefers-reduced-motion: reduce)';
const preference = () => window.matchMedia?.(reducedMotion);

function subscribe(listener: () => void) {
  const query = preference();
  query?.addEventListener?.('change', listener);
  return () => query?.removeEventListener?.('change', listener);
}

export function HeroVideo() {
  const reduced = useSyncExternalStore(subscribe, () => preference()?.matches ?? false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const player = video.current;
    if (reduced && player && !player.paused) player.pause();
  }, [reduced]);

  return <video ref={video} src={prismaHeroVideo} muted loop playsInline autoPlay={!reduced} preload="auto"
    aria-hidden className="pointer-events-none absolute inset-0 -z-20 size-full object-cover object-center" />;
}
