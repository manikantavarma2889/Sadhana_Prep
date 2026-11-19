import { LearningTrackCards } from '../components/LearningTrackCards.tsx';
import { PageHeading } from '../components/ui.tsx';
import { prepHubPath } from '../features/learning-tracks.ts';

export function PrepHub() {
  return <>
    <PageHeading title="Prep Hub" />
    <section className="workspace-learning-hub" aria-labelledby="workspace-learning-title">
      <h2 id="workspace-learning-title">Learning tracks</h2>
      <p>Build foundations before your next interview. Pick a subject to explore its lessons and exercises.</p>
      <LearningTrackCards basePath={prepHubPath} />
    </section>
  </>;
}
