import { Braces, Database, Layers3, Network, PanelTop, Users } from 'lucide-react';
import type { Track } from '../../../shared/contracts.ts';

export const trackDetails = {
  practice: { icon: Users, description: 'Resume-based practice without a job description' },
  java: { icon: Braces, description: 'Core Java, collections, JVM and Spring' },
  python: { icon: Braces, description: 'Python, APIs and language fundamentals' },
  technical: { icon: Layers3, description: 'Core software engineering and technical fundamentals' },
  dsa: { icon: Network, description: 'Data structures, algorithms and complexity' },
  database: { icon: Database, description: 'SQL, schema design, indexes and transactions' },
  devops: { icon: Layers3, description: 'CI/CD, containers and reliable delivery' },
  cloud: { icon: Network, description: 'Cloud architecture, infrastructure and resilience' },
  mobile: { icon: PanelTop, description: 'Mobile UI, application state and platform APIs' },
  'data-science': { icon: Network, description: 'Statistics, machine learning and data pipelines' },
  qa: { icon: Layers3, description: 'Test strategy, automation and quality engineering' },
  frontend: { icon: PanelTop, description: 'UI, rendering and accessibility' },
  backend: { icon: Database, description: 'APIs, data and reliability' },
  mern: { icon: Layers3, description: 'MongoDB, Express, React and Node' },
  javascript: { icon: Braces, description: 'Language fundamentals and types' },
  'system-design': { icon: Network, description: 'Scale, trade-offs and constraints' },
  behavioral: { icon: Users, description: 'Ownership and collaboration' },
} satisfies Record<Track, { icon: typeof PanelTop; description: string }>;
