import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Clock3, FileText, FolderClosed, Lightbulb, LockKeyhole, Menu, Pause, Play, RotateCcw } from 'lucide-react';
import type { LearningDetail, LearningEntry } from '../../../shared/learning.ts';
import type { DesignLesson, DesignScene, DesignStep } from '../../../shared/system-design-course.ts';
import { readStoredIds } from '../features/learning-tracks.ts';
import { DesignIcon, SystemDesignDiagram } from './SystemDesignDiagram.tsx';
import { ErrorNotice, Loading } from './ui.tsx';
import './system-design-course.css';

const previewScene: DesignScene = {
  nodes: [
    { id: 'address', type: 'pill', x: 500, y: 102, label: 'https://shop.example', icn: 'globe' },
    { id: 'browser', type: 'laptop', x: 500, y: 290 },
    { id: 'you', type: 'pill', x: 500, y: 462, label: 'you', icn: 'user' },
  ],
  edges: [],
};
const previewSteps: DesignStep[] = [{
  name: 'Preview', kind: 'CONCEPT', title: 'Course preview', body: [], key: '',
  add: ['address', 'browser', 'you'], focus: ['browser'],
}];

type CourseProps = {
  entries: LearningEntry[];
  selected: LearningEntry | undefined;
  detail: LearningDetail | undefined;
  completed: string[];
  progressKey?: string;
  locked: boolean;
  loading: boolean;
  error: unknown;
  retry: () => void;
  open: (entry: LearningEntry) => void;
  toggle: (id: string) => void;
  reset: () => void;
  lessonPanel: Ref<HTMLDivElement>;
};

function CourseOutline({ entries, selected, completed, locked, open, reset }: Pick<CourseProps, 'entries' | 'selected' | 'completed' | 'locked' | 'open' | 'reset'>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set([selected?.topic ?? entries[0]?.topic]));
  const id = useId();
  const topic = selected?.topic;
  useEffect(() => {
    if (topic) setExpanded(previous => previous.has(topic) ? previous : new Set([...previous, topic]));
  }, [topic]);

  const groups = Array.from(new Set(entries.map(entry => entry.topic)), topic => {
    const lessons = entries.filter(entry => entry.topic === topic);
    return { topic, module: lessons[0]?.module, lessons, done: lessons.filter(lesson => completed.includes(lesson.id)).length };
  });
  const done = groups.reduce((total, group) => total + group.done, 0);

  function toggleGroup(topic: string) {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  return <aside className="design-outline design-panel" data-open={menuOpen}>
    <div className="design-outline-heading"><BookOpen size={16} aria-hidden /><h3>Course outline</h3><small>{entries.length} {locked ? 'in preview' : 'lessons'}</small></div>
    <button className="design-outline-toggle" type="button" aria-expanded={menuOpen} aria-controls={id} onClick={() => setMenuOpen(!menuOpen)}>
      <Menu size={17} aria-hidden /> Course outline <ChevronDown size={15} aria-hidden />
    </button>
    <div className="design-outline-body" id={id}>
      <nav aria-label="Course lessons">
        {groups.map(({ topic, module, lessons, done }, index) => <div className="design-module" key={topic}>
          <button type="button" className="design-module-toggle" onClick={() => toggleGroup(topic)}
            aria-expanded={expanded.has(topic)} aria-controls={id + '-module-' + index}>
            <ChevronDown size={13} aria-hidden /><FolderClosed size={15} fill={module?.color ?? '#d2bf96'} aria-hidden />
            <span>{module ? module.number + '. ' : ''}{topic}</span>
            <small>{locked ? lessons.length : done + '/' + lessons.length}</small>
          </button>
          <ul id={id + '-module-' + index} hidden={!expanded.has(topic)}>
            {lessons.map(lesson => <li key={lesson.id}>
              <button type="button" className="design-lesson-link" aria-current={selected?.id === lesson.id ? 'step' : undefined}
                onClick={() => { setMenuOpen(false); open(lesson); }}>
                {locked ? <LockKeyhole size={13} aria-hidden /> : completed.includes(lesson.id) ? <Check size={14} aria-label="Completed" /> : <FileText size={13} aria-hidden />}
                <span>{lesson.title}</span>
              </button>
            </li>)}
          </ul>
        </div>)}
      </nav>
      {!locked && <details className="design-course-progress">
        <summary>Course progress <strong>{done} / {entries.length}</strong><ChevronDown size={14} aria-hidden /></summary>
        <div className="design-course-progress-detail">
          {groups.map(group => <div key={group.topic}>
            <span>{group.topic}</span><small>{group.done} / {group.lessons.length}</small>
            <progress value={group.done} max={group.lessons.length} aria-label={group.topic + ' progress'} />
          </div>)}
          {confirmReset ? <div className="design-reset">
            <p>Clear lesson completions and checklists for this course?</p>
            <button className="design-button" type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="design-button design-button-reset" type="button" onClick={reset}>Clear progress</button>
          </div> : <button className="design-button design-button-reset" type="button" onClick={() => setConfirmReset(true)}>Reset course progress</button>}
        </div>
      </details>}
    </div>
  </aside>;
}

function metricValues(steps: DesignStep[], count: number) {
  return Object.assign({} as Record<string, number>, ...steps.slice(0, count).map(step => step.metrics));
}

function ExampleMetrics({ course, step, paused, reduced }: { course: DesignLesson; step: number; paused: boolean; reduced: boolean }) {
  const elapsed = useRef(0);
  const [time, setTime] = useState(0);
  const changed = course.steps[step]?.metrics;
  const previous = metricValues(course.steps, step);
  const current = { ...previous, ...changed };

  useEffect(() => {
    if (paused || reduced || !changed || elapsed.current >= 740) return;
    let frame = 0;
    let last = performance.now();
    function animate(now: number) {
      elapsed.current = Math.min(740, elapsed.current + now - last);
      last = now;
      setTime(elapsed.current);
      if (elapsed.current < 740) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [changed, paused, reduced]);

  const blend = reduced ? 1 : Math.max(0, (time - 100) / 640);
  return <dl className="design-canvas-metrics" aria-label="Example metrics">
    {course.metrics.map(metric => {
      const value = current[metric.id];
      const start = previous[metric.id] ?? 0;
      const displayed = changed?.[metric.id] === undefined ? value : start + (value - start) * (1 - (1 - blend) ** 2);
      return <div key={metric.id} data-changing={changed?.[metric.id] !== undefined}>
        <dt><DesignIcon name={metric.icn} size={11} />{metric.label}</dt>
        <dd>{displayed === undefined ? '—' : <>{Math.abs(displayed) >= 100 ? Math.round(displayed) : Math.round(displayed * 10) / 10}<small>{metric.unit}</small></>}</dd>
      </div>;
    })}
  </dl>;
}

function LessonChecklist({ outcomes, checked, toggle }: { outcomes: string[]; checked: string[]; toggle: (title: string) => void }) {
  return <section className="design-panel design-checklist" aria-label="Lesson checklist">
    <h4>You’ll learn</h4>
    {outcomes.map(outcome => <label key={outcome}>
      <input type="checkbox" checked={checked.includes(outcome)} onChange={() => toggle(outcome)} /><span>{outcome}</span>
    </label>)}
  </section>;
}

function CourseLesson({ detail, course, done, toggle, progressKey, lessonPanel, selected, nextLesson, open }: {
  detail: LearningDetail; course: DesignLesson; done: boolean; toggle: () => void; progressKey?: string; lessonPanel: Ref<HTMLDivElement>;
  selected: LearningEntry[]; nextLesson?: LearningEntry; open: (entry: LearningEntry) => void;
}) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const storageKey = progressKey && progressKey + ':checklist:' + detail.id;
  const [checked, setChecked] = useState(() => readStoredIds(storageKey) ?? []);
  const reduced = useReducedMotion() === true;
  const current = course.steps[step];
  const last = step === course.steps.length - 1;

  function writeChecklist(next: string[]) {
    setChecked(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the checklist available for this visit. */ }
    }
  }

  function finish() {
    if (!done) toggle();
    writeChecklist(course.outcomes);
    setFinished(true);
  }

  function go(index: number) {
    setStep(Math.min(course.steps.length - 1, Math.max(0, index)));
    setPaused(false);
  }

  function replay() {
    setPaused(false);
    setReplayCount(count => count + 1);
  }

  function shortcuts(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLInputElement)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      go(step + (event.key === 'ArrowLeft' ? -1 : 1));
    } else if (!reduced && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      replay();
    } else if (!reduced && event.key === ' ' && event.target instanceof HTMLElement && !event.target.closest('button,a,summary')) {
      event.preventDefault();
      setPaused(value => !value);
    }
  }

  return <>
    <div className="design-center" ref={lessonPanel} onKeyDown={shortcuts} tabIndex={0} aria-label="Course visualization controls">
      <header className="design-lesson-heading">
        <span>{detail.module?.number && detail.module.number + '. '}{detail.topic} / Lesson {selected.findIndex(lesson => lesson.id === detail.id) + 1} of {selected.length}</span>
        <div><h3>{detail.title}</h3><div className="design-badges"><span><Clock3 size={12} aria-hidden />{course.minutes} min</span>
          <span>{detail.level === 'Foundations' ? 'Beginner' : detail.level}</span><span>{course.steps.length} steps</span></div></div>
        <p>{detail.summary}</p>
      </header>
      <section className="design-panel design-canvas" aria-label="Lesson visualization" data-paused={paused || reduced}>
        <div className="design-canvas-top">
          <ExampleMetrics key={step + ':' + replayCount} course={course} step={step} paused={paused} reduced={reduced} />
          <div className="design-animation-controls" role="group" aria-label="Diagram playback">
            <button className="design-button" onClick={replay} disabled={reduced}><RotateCcw size={15} aria-hidden /> Replay</button>
            <button className="design-button" onClick={() => setPaused(!paused)} disabled={reduced}>
              {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}{paused ? 'Play' : 'Pause'}
            </button>
          </div>
        </div>
        <div className="design-stage-wrap">
          {current.note && <p key={step} className="design-scene-note">{current.note}</p>}
          <SystemDesignDiagram scene={course.scene} steps={course.steps} index={step} paused={paused} reduced={reduced} replay={replayCount} />
        </div>
        <div className="design-legend"><span><i />Request</span><span><i />Response</span><span><i />Handshake</span></div>
      </section>
      <section className="design-panel design-timeline" aria-label="Lesson steps">
        <div><h4>In this lesson</h4><span>Step {step + 1} of {course.steps.length}</span></div>
        <div className="design-timeline-scroll">
          <ol style={{ minWidth: course.steps.length * 3.55 + 'rem' }}>
            {course.steps.map((part, index) => <li key={index}>
              <button type="button" aria-current={step === index ? 'step' : undefined} data-passed={index < step} onClick={() => go(index)}>
                <span>{index + 1}</span>{part.name}
              </button>
            </li>)}
          </ol>
        </div>
      </section>
    </div>
    <aside className="design-notes" onKeyDown={shortcuts} aria-label="Lesson notes">
      <section className="design-panel design-step-card">
        <div className="design-step-text" aria-live="polite">
          <div className="design-step-heading"><span>Step {step + 1} / {course.steps.length}</span><span data-kind={current.kind}>{current.kind}</span></div>
          <h4>{current.title}</h4>
          {current.body.map((paragraph, index) => <p key={index}>{paragraph.split(/(<code>.*?<\/code>)/g).map((part, fragment) =>
            part.startsWith('<code>') ? <code key={fragment}>{part.slice(6, -7)}</code> : part)}</p>)}
          <div className="design-key-idea"><Lightbulb size={18} aria-hidden /><div><strong>Key idea</strong><p>{current.key}</p></div></div>
        </div>
        <div className="design-step-controls">
          <button type="button" className="design-button" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={15} aria-hidden /> Back</button>
          {!last ? <button type="button" className="design-button design-button-primary" onClick={() => go(step + 1)}>Next: {course.steps[step + 1].name} <ArrowRight size={15} aria-hidden /></button>
            : finished ? <button type="button" className="design-button design-button-primary" disabled={!nextLesson} onClick={() => nextLesson && open(nextLesson)}>
              {nextLesson ? 'Next lesson: ' + nextLesson.title : 'Course complete'}<ArrowRight size={15} aria-hidden />
            </button> : <button type="button" className="design-button design-button-primary" onClick={finish}>Finish lesson <Check size={15} aria-hidden /></button>}
        </div>
        <div className="design-shortcuts"><kbd>←</kbd><kbd>→</kbd> Steps{!reduced && <> <kbd>R</kbd> Replay <kbd>Space</kbd> Pause</>}</div>
        {finished && <p className="design-lesson-complete" role="status">Lesson complete</p>}
      </section>
      <LessonChecklist outcomes={course.outcomes} checked={checked}
        toggle={outcome => {
          const stored = readStoredIds(storageKey) ?? checked;
          writeChecklist(checked.includes(outcome) ? stored.filter(value => value !== outcome) : [...new Set([...stored, outcome])]);
        }} />
    </aside>
  </>;
}

export function SystemDesignCourse({ entries, selected, detail, completed, progressKey, locked, loading, error, retry, open, toggle, reset, lessonPanel }: CourseProps) {
  const course = detail?.course;
  const activeIndex = entries.findIndex(entry => entry.id === selected?.id);
  return <div className="design-course-container"><div className="design-workbench">
    <CourseOutline entries={entries} selected={selected} completed={completed} locked={locked} open={open} reset={reset} />
    {locked ? <>
      <section className="design-center">
        <header className="design-lesson-heading"><span>Course preview</span><div><h3>Trace how systems work</h3></div>
          <p>Explore the path from a browser request to the services behind it.</p></header>
        <div className="design-panel design-canvas" data-paused="true">
          <SystemDesignDiagram scene={previewScene} steps={previewSteps} index={0} paused reduced />
        </div>
      </section>
      <aside className="design-notes"><section className="design-panel design-step-card">
        <div className="design-step-text">
          <div className="design-step-heading"><span>Course preview</span><span>Learn</span></div>
          <h4>Explore a lesson</h4><p>Open a lesson from the outline to step through its diagram, read the notes, and track your progress.</p>
        </div>
        {entries[0] && <button type="button" className="design-button design-button-primary" onClick={() => open(entries[0])}>
          Start first lesson <ArrowRight size={15} aria-hidden /></button>}
      </section></aside>
    </> : course && detail && detail.id === selected?.id ? <CourseLesson key={detail.id} detail={detail} course={course}
      done={completed.includes(detail.id)} toggle={() => toggle(detail.id)} progressKey={progressKey} lessonPanel={lessonPanel}
      selected={entries.filter(entry => entry.topic === detail.topic)} nextLesson={entries[activeIndex + 1]} open={open} />
      : <div className="design-center design-panel design-course-loading" ref={lessonPanel}>
        {loading && <Loading label="Opening lesson…" />}<ErrorNotice error={error} retry={retry} />
        {detail && !course && <p>Reload the course to get the latest lesson content.</p>}
      </div>}
  </div></div>;
}

