import type { LearningDetail, LearningLevel } from '../../../../shared/learning.ts';
import { designModules, designScenes } from './system-design-content.ts';

// Keep URLs and saved completions from the earlier System Design lessons.
const existingIds: Record<string, string> = {
  request: 'request-path', napkin: 'capacity', lb: 'load-balancing', cache101: 'caching',
  pressure: 'rate-limits', retries: 'failure-recovery',
};

export const designLessons: LearningDetail[] = designModules.flatMap(module => module.lessons.map(lesson => {
  const scene = designScenes[lesson.scene];
  if (!scene) throw new Error('Missing System Design scene for ' + lesson.id);
  return {
    id: existingIds[lesson.id] ?? lesson.id,
    title: lesson.title, topic: module.title, summary: lesson.summary,
    module: { number: module.num, color: module.color },
    level: lesson.level === 'Beginner' ? 'Foundations' : lesson.level,
    notes: [],
    course: { minutes: lesson.minutes, outcomes: lesson.outcomes, metrics: lesson.metrics, steps: lesson.steps, scene },
  };
}));

function designCase(id: string, title: string, level: LearningLevel, summary: string, requirements: string, approach: string, tradeoff: string): LearningDetail {
  return {
    id, title, level, summary, topic: 'Design cases',
    notes: [{ title: 'Clarify requirements', text: requirements }, { title: 'Sketch an approach', text: approach }, { title: 'Discuss the trade-off', text: tradeoff }],
  };
}

export const designCases = [
  designCase('short-links', 'Short links', 'Foundations', 'Design a service that creates short links and redirects readers.',
    'Decide whether aliases are custom, editable, or expiring. Estimate redirect volume and choose what availability the redirect path needs.',
    'Store alias → destination with a uniqueness constraint. Generate collisions safely, cache popular redirects, and collect analytics asynchronously.',
    'Permanent redirects can be cached by clients beyond your control. Consider temporary redirects for editable links.'),
  designCase('notification-inbox', 'Notification inbox', 'Intermediate', 'Deliver notifications through an in-app inbox and optional email.',
    'Ask about user preferences, read status, ordering, delivery guarantees, and deadlines.',
    'Persist notification records separately from delivery jobs. Use retryable workers per channel and idempotency keys for duplicate events.',
    'A provider timeout can leave delivery ambiguous. Decide what duplicates cost and how you would reconcile uncertain attempts.'),
  designCase('timeline', 'Activity timeline', 'Intermediate', 'Build a timeline for people following a mix of small and large accounts.',
    'Specify ordering, acceptable freshness, feed size, and how edits and deletes should propagate.',
    'For typical accounts, fan out references on write. For very large accounts, merge recent entries at read time.',
    'Fan-out on write spends storage and background capacity. Fan-out on read shifts work to the latency-sensitive path.'),
  designCase('chat-room', 'Group chat', 'Intermediate', 'Support message history and near-real-time delivery across devices.',
    'Define message ordering scope, reconnect behavior, retained history, and typing indicators.',
    'Persist a conversation-scoped sequence. Push new messages through live connections and let reconnected clients catch up from a cursor.',
    'Separate durable messages from transient presence. Large rooms change the cost of per-recipient fan-out.'),
  designCase('file-uploads', 'Resumable file uploads', 'Intermediate', 'Support large uploads over unreliable networks.',
    'Decide on maximum file size, checksum guarantees, retention of unfinished uploads, and when a file becomes downloadable.',
    'Assign an upload session. Upload independent numbered parts, verify checksums, and commit the manifest once all parts complete.',
    'Larger parts reduce coordination but increase retry cost. Expire abandoned sessions and release their stored parts.'),
  designCase('jobs', 'Scheduled job runner', 'Advanced', 'Run delayed and recurring tasks across a worker fleet.',
    'Define schedule precision, execution duration, and whether tasks may happen twice.',
    'Index due jobs by timestamp, claim them with expiring leases, and store attempt counts for retries.',
    'A worker may outlive its lease. Use idempotent side effects or fenced updates for work requiring exclusive ownership.'),
  designCase('inventory', 'Limited inventory checkout', 'Advanced', 'Reserve a small stock of items while customers complete payment.',
    'Establish hold duration, oversell policy, payment behavior, and what happens when a late confirmation arrives.',
    'Create an expiring reservation through an atomic stock update. Reconcile payment events idempotently, then confirm or release the hold.',
    'Availability and correctness can conflict during a partition. Decide whether an uncertain reservation must fail or wait.'),
  designCase('metrics', 'Service metrics pipeline', 'Advanced', 'Collect service measurements and support recent dashboards and alerts.',
    'Estimate samples per second and retention. Define acceptable data loss and query latency.',
    'Batch and buffer samples, reject excessive label cardinality, and store time-windowed aggregates for long retention.',
    'Dropping labels controls cost but reduces diagnostic detail. Keep high-cardinality context in sampled traces or logs.'),
];

