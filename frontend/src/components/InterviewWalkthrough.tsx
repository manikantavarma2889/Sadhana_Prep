import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import answerImage from '../assets/interview-demo/answer.jpg';
import reportImage from '../assets/interview-demo/report.jpg';
import roleImage from '../assets/interview-demo/role.jpg';
import './interview-walkthrough.css';

const steps = [
  {
    title: 'Upload your résumé and add a role',
    description: 'Upload a résumé PDF, select its profile, and add the target role and job description. The AI analyzes the role alongside your résumé skills to identify what matches, where you have gaps, and which topics to practice.',
    image: roleImage,
    alt: 'Sample role analysis for a full-stack engineer showing matched skills, skill gaps, and interview topics.',
    label: 'Résumé and role',
  },
  {
    title: 'Answer the AI’s questions aloud',
    description: 'The AI asks interview questions about your track and target role. Record your answer on a supported browser or type it in. Explain how you would approach the problem and respond to follow-up questions as you go.',
    image: answerImage,
    alt: 'Sample interview question with question playback, a Record answer button, and a transcript field.',
    label: 'Voice interview',
  },
  {
    title: 'Review the feedback',
    description: 'See how you did on communication clarity, technical accuracy, reasoning, completeness, and relevance to the role or question. The report cites excerpts from your answers and shows what to work on before the next round.',
    image: reportImage,
    alt: 'Sample interview report with scores, answer evidence, and feedback.',
    label: 'Feedback report',
  },
];

export function InterviewWalkthrough() {
  const runway = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const track = runway.current;
    const panel = stage.current;
    if (!track || !panel) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const distance = Number.parseFloat(getComputedStyle(panel).top) - track.getBoundingClientRect().top;
      const available = Math.max(1, track.offsetHeight - panel.offsetHeight);
      const progress = Math.min(1, Math.max(0, distance / available));
      setActive(Math.round(progress * (steps.length - 1)));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(track);
    observer.observe(panel);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  function jump(index: number) {
    const track = runway.current;
    const panel = stage.current;
    if (!track || !panel) return;
    const available = track.offsetHeight - panel.offsetHeight;
    const pinnedTop = Number.parseFloat(getComputedStyle(panel).top);
    window.scrollTo({
      top: window.scrollY + track.getBoundingClientRect().top - pinnedTop + available * index / (steps.length - 1),
      behavior: reduced ? 'instant' : 'smooth',
    });
  }

  return <section className="public-section interview-walkthrough" id="how-it-works" aria-labelledby="how-it-works-title">
    <div className="public-section-head">
      <h2 id="how-it-works-title">How it works</h2>
      <p>Scroll through a sample interview, from setting up your role to reviewing the report.</p>
    </div>
    <div className="walkthrough-runway" ref={runway}>
      <div className="walkthrough-stage" ref={stage}>
        <div className="walkthrough-controls" role="group" aria-label="Interview walkthrough steps">
          {steps.map((step, index) => <button className="walkthrough-tab" key={step.title} type="button" onClick={() => jump(index)}
            aria-pressed={active === index}><span>0{index + 1}</span><span>{step.label}</span></button>)}
        </div>
        <div className="walkthrough-panels">
          {steps.map((step, index) => (
            <article className="walkthrough-panel" key={step.title} aria-hidden={index !== active} data-active={index === active}>
              <figure className="walkthrough-image"><img src={step.image} alt={step.alt} loading="lazy" decoding="async" /></figure>
              <div className="walkthrough-copy"><h3>{step.title}</h3><p>{step.description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>;
}

