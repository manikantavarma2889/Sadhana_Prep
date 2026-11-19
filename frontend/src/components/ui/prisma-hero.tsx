import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { HeroVideo } from './hero-video.tsx';
import './prisma-hero.css';

const ease = [0.16, 1, 0.3, 1] as const;
const below = { y: 20, opacity: 0 };
const settled = { y: 0, opacity: 1 };

function WordsPullUp({ text, reduced }: { text: string; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref);

  return (
    <span ref={ref} className="inline-flex flex-wrap gap-x-[.2em]">
      {text.split(' ').map((word, index) => (
        <motion.span key={word} aria-hidden
          initial={reduced ? false : below}
          animate={isInView || reduced ? settled : below}
          transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : index * 0.08, ease }}>
          {word}
        </motion.span>
      ))}
    </span>
  );
}

export function PrismaHero() {
  const reduced = useReducedMotion() === true;

  return (
    <section aria-labelledby="prep-hero-title" className="prisma-hero relative isolate flex flex-col overflow-hidden">
      <HeroVideo />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-black/30 via-transparent to-black/80" />

      <div className="mt-auto grid items-end gap-6 px-5 pt-24 pb-8 sm:px-9 sm:pb-9 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,26%)] lg:gap-9 lg:px-11 lg:pb-12">
        <h1 id="prep-hero-title" aria-label="Sadhana Prep" className="prisma-hero-title">
          <WordsPullUp text="Sadhana Prep" reduced={reduced} />
        </h1>
        <div className="flex flex-col items-start gap-4 lg:pb-2">
          <motion.p initial={reduced ? false : below} animate={settled}
            transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.5, ease }}
            className="max-w-sm text-sm sm:text-base">
            Practice technical and behavioral interviews. Rehearse follow-up questions and review feedback grounded in your answers.
          </motion.p>
          <motion.div initial={reduced ? false : below} animate={settled}
            transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.7, ease }}>
            <Link to="/#preparation" className="button button-primary button-arrow">
              Explore preparation <span><ArrowRight size={16} aria-hidden /></span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
