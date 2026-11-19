import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import answerImage from '../assets/interview-demo/voice-interview.png';
import reportImage from '../assets/interview-demo/feedback-report.png';
import roleImage from '../assets/interview-demo/session-setup.png';
import './interview-walkthrough.css';

const steps = [
  {
    title: 'Set up and analyze your interview',
    description: 'Choose an interview track, add your role title and job description, then set the difficulty, duration, and resume. Sadhana analyzes the projects, technologies, and experience in your resume alongside the role to identify relevant skills, gaps, and practice topics. For subject-only practice, select Practice interview and a subject, with your resume still required. Review the analysis, then start when your session is ready.',
    image: roleImage,
    alt: 'Sadhana Prep interview setup with a MERN track, role title, job description, difficulty, duration, resume, and completed analysis.',
    label: 'Resume and role',
  },
  {
    title: 'Practice a conversation with Sadhana',
    description: 'Begin with an introduction, then answer technical questions focused on your track and role, alongside questions about your resume projects and a smaller set of behavioral questions. Easy stays easy; Intermediate and Hard begin with fundamentals before moving to your chosen level. Questions continue for your selected duration. Speak with live captions or type in chat, then press Done answering to submit your spoken answer as text.',
    image: answerImage,
    alt: 'Sadhana AI asking a React interview question in the voice interview room, with captions, call controls, and in-call messages.',
    label: 'Voice interview',
  },
  {
    title: 'Turn your feedback into a practice plan',
    description: 'Review your overall score, questions answered, average words per answer, filler words, and session duration. For each submitted answer, the AI scores applicable dimensions: technical accuracy, conceptual understanding, problem solving, communication clarity, completeness, reasoning, and relevance. Scores include excerpts from your answer and an explanation, with strengths, improvements, and priorities for next time. Use the feedback to choose what to study and practice again.',
    image: reportImage,
    alt: 'Sadhana Prep interview summary showing an overall score, answer metrics, focus areas, and evidence-based scoring for individual answers.',
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
      <p>From resume and role analysis to a voice interview and feedback you can act on.</p>
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

