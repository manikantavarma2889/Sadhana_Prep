import { interviewQuestionCounts, type InterviewSettings, type Track } from '../../../../shared/contracts.ts';

type BankItem = [topic: string, question: string, criterion: string];

const bank: Record<Track, BankItem[]> = {
  frontend: [
    ['React state', 'A filterable list resets its selected row after a search. How would you locate and fix the state bug?', 'Distinguishes local and server state, stable keys and state ownership.'],
    ['Accessibility', 'How would you implement a dialog that works for keyboard and screen-reader users?', 'Covers semantics, focus entry, containment, dismissal and return.'],
    ['Rendering performance', 'A typing interaction becomes slow as a table grows. How would you measure and improve it?', 'Measures first, isolates renders and considers virtualization and scheduling.'],
    ['Network state', 'How should an interface behave when a save succeeds on the server but its response is lost?', 'Explains retry, idempotency and reconciling client state.'],
    ['CSS layout', 'A two-column page must fit both translated content and small screens. How would you design its layout?', 'Uses fluid sizing, wrapping, breakpoints and content stress tests.'],
    ['Frontend testing', 'Which tests would you write for a checkout form with async validation?', 'Covers interaction, loading and error states plus one critical end-to-end path.'],
  ],
  backend: [
    ['API design', 'Design an endpoint for creating a booking that users may retry after a timeout.', 'Defines idempotency key, atomic write, safe retry and status codes.'],
    ['Database indexes', 'A paginated account dashboard slows down as records accumulate. How do you choose and verify an index?', 'Uses query shape, compound indexes, cursor pagination and explain plans.'],
    ['Authentication', 'How would you invalidate access safely when a user signs out of one device?', 'Explains token lifetime, session revocation and device scoping.'],
    ['Queues', 'A worker sometimes processes the same job twice. How would you design completion and retry?', 'Explains at-least-once delivery, idempotent effects and backoff.'],
    ['Observability', 'How would you diagnose a sudden increase in API tail latency?', 'Uses percentiles, request traces, dependency timing and controlled mitigation.'],
    ['Authorization', 'How would you design authorization for documents shared within multiple organizations?', 'Scopes reads and writes to membership and target resource.'],
  ],
  mern: [
    ['React Query', 'How would you keep a React list and detail view consistent after a successful Express mutation?', 'Covers query keys, invalidation, response data and rollback.'],
    ['MongoDB modeling', 'When would you embed comments in a MongoDB document versus putting them in a separate collection?', 'Compares access patterns, bound sizes, indexes and atomicity.'],
    ['Express validation', 'How would you validate a request from React and present field errors in the form?', 'Validates on the server, returns a stable error shape and handles errors accessibly.'],
    ['Sessions', 'How would you secure a React and Express session on a single origin?', 'Covers protected endpoints, cookie properties, expiration, origin checks and ownership.'],
    ['Concurrency', 'Two browser tabs submit updates for the same record. How should the API handle that?', 'Uses optimistic revision and conflicts with client reconciliation.'],
    ['Shipping', 'What would you verify before releasing a MERN application to production?', 'Covers automated tests, configuration, readiness, rollback and logs.'],
  ],
  javascript: [
    ['Event loop', 'What runs first when synchronous code schedules a promise callback and a zero-delay timer, and why?', 'Correctly explains call stack, microtasks and timer tasks.'],
    ['Type narrowing', 'How would you represent loading, success and error states so TypeScript can narrow each one safely?', 'Uses a discriminated union and appropriate exhaustiveness checks.'],
    ['Closures', 'Explain how a callback can read stale data even though the outer variable appears to have changed.', 'Explains lexical scope and lifetime with an example.'],
    ['Cancellation', 'How would you cancel a stale fetch in a search box and prevent older results from replacing newer ones?', 'Covers AbortController and ignoring racing results.'],
    ['Runtime validation', 'What does a TypeScript type guarantee when parsing JSON from an external API?', 'Distinguishes static types from runtime data checks.'],
    ['Error handling', 'When should a group of concurrent promises fail as a unit, and when should it return partial results?', 'Explains Promise.all, allSettled and effect management.'],
  ],
  'system-design': [
    ['Rate limiting', 'Design a rate limiter for a public API used by many accounts and multiple server instances.', 'Addresses identity, budgets, coordination, bursts and failure mode.'],
    ['Caching', 'Design caching for a frequently read product catalog whose prices must update quickly.', 'Defines staleness, invalidation, cache keys and recovery.'],
    ['Consistency', 'Design an inventory reservation where two users might attempt to buy the final item.', 'Explains atomic reservation, expiration and recovery.'],
    ['Event processing', 'Design a notification service that can absorb traffic spikes without sending duplicate notifications.', 'Covers durable queue, deduplication, backpressure and measurement.'],
    ['Reliability', 'How would you redesign an application when a third-party dependency often times out?', 'Addresses deadlines, circuit breaking, fallbacks and observability.'],
    ['Scaling', 'Design a dashboard that queries a growing stream of usage events.', 'Explains write/read patterns, aggregation, storage and workload bounds.'],
  ],
  behavioral: [
    ['Ownership', 'Tell me about a time you owned a problem that lacked a clear owner. What changed because of your actions?', 'Describes responsibility, concrete action and outcome.'],
    ['Feedback', 'Describe a time you received feedback you initially disagreed with. What did you do next?', 'Shares the feedback, response, reflection and result.'],
    ['Collaboration', 'Describe a technical disagreement with a teammate and how you reached a decision.', 'Explains perspectives, trade-offs, collaboration and decision.'],
    ['Prioritization', 'Tell me about a time competing deadlines forced you to make a trade-off.', 'Explains constraints, criteria, communication and results.'],
    ['Learning', 'Describe a mistake you made on a project and how it changed your process.', 'Takes ownership and explains lasting improvement.'],
    ['Ambiguity', 'Describe how you delivered work when the requirements were incomplete.', 'Shows clarification, assumption management and validation.'],
  ],
};

export function localPlan(settings: InterviewSettings, topics: string[]) {
  const questions = bank[settings.track].map(([topic, text, criterion]) => ({ topic, text, criterion }));
  if (topics[0] && settings.track !== 'behavioral') {
    const topic = topics[0];
    questions.unshift({
      topic, text: 'How would you use ' + topic + ' to solve a realistic problem for this role?',
      criterion: 'Explains a concrete application of ' + topic + ', its constraints and how to verify the result.',
    });
  }
  const follow = {
    foundation: ' Walk through one simple example.',
    intermediate: '',
    advanced: ' Explain a difficult constraint and how you would verify your decision.',
  }[settings.difficulty];
  return questions.slice(0, interviewQuestionCounts[settings.minutes]).map(question => ({ ...question, text: question.text + follow }));
}
