import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { trackLabels, tracks } from '../../../shared/contracts.ts';
import { trackDetails } from '../features/interview-tracks.ts';
import { LearningTrackCards } from './LearningTrackCards.tsx';

export function PreparationSection() {
  return (
    <section className="public-section public-preparation" id="preparation" aria-labelledby="preparation-title">
      <div className="public-section-head">
        <h2 id="preparation-title">Preparation</h2>
        <p>Choose an interview track to practice for a role, or build your foundations in a learning track.</p>
      </div>
      <section className="preparation-group" aria-labelledby="preparation-tracks">
        <h3 id="preparation-tracks">Interview tracks</h3>
        <p>Pick a track, then set the difficulty, duration, and role context for your interview.</p>
        <div className="public-grid">
          {tracks.map(track => {
            const { icon: Icon, description } = trackDetails[track];
            return (
              <Link className="public-card preparation-card" to={'/interviews/new?track=' + track} key={track}
                aria-label={'Practice ' + trackLabels[track]}>
                <div className="preparation-card-heading"><Icon size={22} strokeWidth={1.6} aria-hidden /><ArrowUpRight size={18} aria-hidden /></div>
                <h4>{trackLabels[track]}</h4>
                <p>{description}</p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="preparation-group" id="learning-tracks" aria-labelledby="learning-tracks-title">
        <h3 id="learning-tracks-title">Learning tracks</h3>
        <p>Pick a subject to preview its lessons and exercises.</p>
        <LearningTrackCards basePath="/preparation" titleTag="h4" />
      </section>
    </section>
  );
}
