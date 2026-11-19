import { useId, useLayoutEffect, useRef } from 'react';
import type { DesignFlight, DesignNode, DesignScene, DesignStep } from '../../../shared/system-design-course.ts';
import { designArt, designIcons } from './system-design-art.ts';

export function DesignIcon({ name, size = 15 }: { name: string; size?: number }) {
  const drawing = designIcons[name];
  if (!drawing) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawing }} />;
}

function nodeAnchor(node: DesignNode) {
  return [node.x, node.y - (node.type === 'pill' ? 0 : 22)] as const;
}

function edgeId(a: string, b: string) {
  return a < b ? a + '|' + b : b + '|' + a;
}

function scenePaths(scene: DesignScene, steps: DesignStep[]) {
  const nodes = new Map(scene.nodes.map(node => [node.id, node]));
  const pairs = new Set(scene.edges.map(([a, b]) => edgeId(a, b)));
  for (const step of steps) for (const flight of step.flights ?? []) pairs.add(edgeId(flight.a, flight.b));

  return Array.from(pairs).flatMap((id, index) => {
    const [a, b] = id.split('|');
    const start = nodes.get(a);
    const end = nodes.get(b);
    if (!start || !end) return [];
    const [x1, y1] = nodeAnchor(start);
    const [x2, y2] = nodeAnchor(end);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const bow = (index % 2 ? 1 : -1) * Math.min(26, length * .12);
    const middle = ((x1 + x2) / 2 - (dy / length) * bow) + ' ' + ((y1 + y2) / 2 + (dx / length) * bow);
    return [{ id, a, b, path: 'M' + x1 + ' ' + y1 + 'Q' + middle + ' ' + x2 + ' ' + y2,
      reverse: 'M' + x2 + ' ' + y2 + 'Q' + middle + ' ' + x1 + ' ' + y1 }];
  });
}

function visibleNodes(steps: DesignStep[], through: number) {
  const visible = new Set<string>();
  for (const step of steps.slice(0, through + 1)) {
    for (const id of [...step.add ?? [], ...step.focus ?? [], ...step.alert ?? []]) visible.add(id);
    for (const { a, b } of step.flights ?? []) { visible.add(a); visible.add(b); }
  }
  return visible;
}

function SceneNode({ node, visible, active, alert, gradient }: {
  node: DesignNode; visible: boolean; active: boolean; alert: boolean; gradient: string;
}) {
  const { type, label, icn } = node;
  const pill = type === 'pill';
  const withIcon = Boolean(pill && icn && designIcons[icn]);
  const width = (label?.length ?? 0) * 6.5 + 20 + (withIcon ? 19 : 0);
  const art = (type === 'db' && icn ? designArt['db:' + icn] : undefined) ?? designArt[type] ?? designArt.service;
  return <g className="design-scene-node" data-visible={visible} data-alert={alert} transform={'translate(' + node.x + ' ' + node.y + ')'}>
    {(active || alert) && <ellipse className="design-node-ring" cy={pill ? 0 : 16} rx={type === 'laptop' ? 126 : pill ? width / 2 + 6 : 49}
      ry={type === 'laptop' ? 32 : 17} fill="none" stroke={alert ? '#ac573e' : '#56813e'} strokeWidth="2" strokeDasharray="5 5" />}
    <g className={active || alert ? 'design-node-active' : undefined}>
      {!pill && <g dangerouslySetInnerHTML={{ __html: art.replaceAll('url(#screenGrad)', 'url(#' + gradient + ')') }} />}
      {label && <g transform={pill ? undefined : 'translate(0 32)'}>
        <rect x={-width / 2} y={pill ? -13 : -10} width={width} height={pill ? 26 : 20} rx="10" fill="#fffdf4" stroke="#302b21" strokeWidth="1.5" />
        {withIcon && <g transform={'translate(' + (-width / 2 + 8) + ' -7)'}><DesignIcon name={icn!} size={14} /></g>}
        <text x={withIcon ? 10 : 0} y="1" dominantBaseline="middle" textAnchor="middle" fill="#28251e" fontSize={pill ? 11 : 10} fontWeight="700">{label}</text>
      </g>}
    </g>
  </g>;
}

const flightColors = { req: '#e08043', res: '#75a875', hs: '#fffdf4' };

function DiagramPacket({ flight, path, cycle, loop }: { flight: DesignFlight; path: string; cycle: number; loop: boolean }) {
  const time = loop ? cycle : flight.dur + 310;
  const moveEnd = flight.dur / time;
  const fadeEnd = (flight.dur + 260) / time;
  const begin = flight.delay + 'ms';
  const repeat = loop ? 'indefinite' : '1';
  return <g opacity="0">
    <circle r="6.5" fill={flightColors[flight.kind]} stroke="#302b21" strokeWidth="1.4" strokeDasharray={flight.kind === 'hs' ? '2.5 2' : undefined} />
    {flight.label && <text className="design-packet-label" y="-12" textAnchor="middle">{flight.label}</text>}
    <animateMotion path={path} begin={begin} dur={time + 'ms'} repeatCount={repeat} fill="freeze"
      calcMode="linear" keyPoints="0;1;1" keyTimes={'0;' + moveEnd + ';1'} />
    <animate attributeName="opacity" begin={begin} dur={time + 'ms'} repeatCount={repeat} fill="freeze"
      values="0;1;1;0;0" keyTimes={'0;' + moveEnd * .15 + ';' + moveEnd + ';' + fadeEnd + ';1'} />
  </g>;
}

export function SystemDesignDiagram({ scene, steps, index, paused, reduced, replay = 0 }: {
  scene: DesignScene; steps: DesignStep[]; index: number; paused: boolean; reduced: boolean; replay?: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const gradient = useId();
  const current = steps[index];
  const visible = visibleNodes(steps, index);
  const routes = scenePaths(scene, steps);
  const flights = current?.flights ?? [];
  const cycle = Math.max(0, ...flights.map(flight => flight.delay + flight.dur)) + 700;

  useLayoutEffect(() => { svg.current?.setCurrentTime?.(0); }, [index, replay]);
  useLayoutEffect(() => {
    if (paused || reduced) svg.current?.pauseAnimations?.();
    else svg.current?.unpauseAnimations?.();
  }, [paused, reduced]);

  return <svg ref={svg} className="design-stage" viewBox="0 0 1000 560" role="img"
    aria-label={'Architecture diagram: ' + scene.nodes.filter(node => visible.has(node.id)).map(node => node.label ?? node.type).join(', ')}>
    <defs><linearGradient id={gradient} x2="1" y2="1"><stop stopColor="#c9b8f5" /><stop offset="1" stopColor="#8f7ae8" /></linearGradient></defs>
    {routes.map(route => <path key={route.id} className="design-edge" data-visible={visible.has(route.a) && visible.has(route.b)}
      d={route.path} fill="none" stroke="#a99b77" strokeWidth="2.1" strokeDasharray="5 6" />)}
    {scene.nodes.map(node => <SceneNode key={node.id} node={node} visible={visible.has(node.id)} gradient={gradient}
      active={current?.focus?.includes(node.id) ?? false} alert={current?.alert?.includes(node.id) ?? false} />)}
    {!reduced && <g key={index + ':' + replay}>{flights.map((flight, flightIndex) => {
      const route = routes.find(item => item.id === edgeId(flight.a, flight.b));
      return route && <DiagramPacket key={flightIndex} flight={flight} path={route.a === flight.a ? route.path : route.reverse}
        cycle={cycle} loop={current?.loop === true} />;
    })}</g>}
  </svg>;
}

