import { Braces, Database, Layers3, Network, PanelTop, Users } from 'lucide-react';
import type { Track } from '../../../shared/contracts.ts';

export const trackDetails = {
  frontend: { icon: PanelTop, description: 'UI, rendering and accessibility' },
  backend: { icon: Database, description: 'APIs, data and reliability' },
  mern: { icon: Layers3, description: 'MongoDB, Express, React and Node' },
  javascript: { icon: Braces, description: 'Language fundamentals and types' },
  'system-design': { icon: Network, description: 'Scale, trade-offs and constraints' },
  behavioral: { icon: Users, description: 'Ownership and collaboration' },
} satisfies Record<Track, { icon: typeof PanelTop; description: string }>;
