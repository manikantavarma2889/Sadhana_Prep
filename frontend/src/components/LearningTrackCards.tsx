import { ArrowUpRight, Code2, Database, Network, Server, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { learningTracks } from '../../../shared/learning.ts';
import { learningTrackIds } from '../features/learning-tracks.ts';

const learningIcons = { dsa: Code2, 'system-design': Server, dbms: Database, os: Terminal, networking: Network };
export function LearningTrackCards({ basePath, compact = false, titleTag: Title = 'h3' }: {
  basePath: string; compact?: boolean; titleTag?: 'h3' | 'h4';
}) {
  return <div className={compact ? 'overview-subject-grid' : 'public-grid'}>
    {learningTrackIds.map(track => {
      const Icon = learningIcons[track];
      const { title, description } = learningTracks[track];
      return <Link className={'public-card preparation-card' + (compact ? ' overview-subject-card' : '')} to={basePath + '/' + track} key={track}>
        <div className="preparation-card-heading"><Icon size={22} strokeWidth={1.6} aria-hidden /><ArrowUpRight size={18} aria-hidden /></div>
        <Title>{title}</Title><p>{description}</p>
      </Link>;
    })}
  </div>;
}
