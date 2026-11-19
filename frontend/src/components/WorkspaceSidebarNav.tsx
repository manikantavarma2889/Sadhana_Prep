import { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export type WorkspaceLink = { title: string; path: string; icon: LucideIcon; end?: boolean };

const corner = 6;

function HookRail({ y, from = 0, visible, muted = false }: {
  y: number; from?: number; visible: boolean; muted?: boolean;
}) {
  const bendY = y - corner;
  return (
    <span aria-hidden="true" className={'sidebar-hook' + (muted ? ' sidebar-hook-muted' : '')} data-visible={visible}>
      <span className="sidebar-hook-line" style={{ top: from, height: Math.max(0, bendY - from) }} />
      <svg className="sidebar-hook-bend" style={{ top: bendY }}
        width="12" height="7" viewBox="0 0 12 7" fill="none">
        <path d="M0.5 0a6 6 0 0 0 6 6H12" stroke="currentColor" strokeDasharray="2 2" />
      </svg>
    </span>
  );
}

export function WorkspaceSidebarNav({ items, activePath }: { items: WorkspaceLink[]; activePath?: string }) {
  const list = useRef<HTMLDivElement>(null);
  const [centers, setCenters] = useState<number[]>([]);
  const [pointerIndex, setPointerIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () => {
      const positions = Array.from(element.querySelectorAll('a'), link => link.offsetTop + link.offsetHeight / 2);
      setCenters(previous => previous.length === positions.length && previous.every((y, index) => y === positions[index]) ? previous : positions);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [items.length]);

  const activeIndex = items.findIndex(item => item.path === activePath);
  const previewIndex = pointerIndex ?? focusIndex;
  const activeY = centers[activeIndex];
  const previewY = previewIndex !== null ? centers[previewIndex] : undefined;
  const previewStart = previewY !== undefined && activeY !== undefined && previewY <= activeY
    ? Math.max(0, previewY - corner)
    : activeY ?? 0;

  return (
    <nav aria-label="Workspace" className="side-nav" data-slot="hook-sidebar">
      <div className="side-nav-links" ref={list} onPointerLeave={() => setPointerIndex(null)}>
        <HookRail y={previewY ?? activeY ?? 0} from={previewStart} muted
          visible={previewY !== undefined && previewIndex !== activeIndex} />
        <HookRail y={activeY ?? 0} visible={activeY !== undefined} />
        {items.map(({ title, path, icon: Icon }, index) => {
          const active = activeIndex === index;
          return <Link key={path} to={path} className={'nav-link' + (active ? ' active' : '')}
            data-slot="hook-sidebar-item" aria-label={title} aria-current={active ? 'page' : undefined}
            onPointerEnter={event => { if (event.pointerType === 'mouse') setPointerIndex(index); }}
            onFocus={() => setFocusIndex(index)} onBlur={() => setFocusIndex(null)}>
            <Icon size={19} aria-hidden /><span>{title}</span>
          </Link>;
        })}
      </div>
    </nav>
  );
}

