# InterviewForge architecture

```text
Browser
  React Router → page and local form state
  TanStack Query → private API cache
       ↓ same-origin /api/v1
Express → validation and authentication → services
       ├─ Mongoose → MongoDB
       ├─ LangChain → configured chat model
       └─ PDF child process → extracted skills

Report worker → MongoDB lease → coaching adapter → verified evidence
```

The root is an npm workspace. `frontend/src` contains routed pages and the modular voice hook. `backend/src/app.ts` is the HTTP boundary. `backend/src/services` owns decisions about credentials, resumes, interviews and grading. The Mongoose repository and the memory adapter share a typed interface. The memory adapter is used by demo mode and deterministic tests. `shared/contracts.ts` defines the public domain types. The server validates inputs with Zod and returns explicit DTOs that omit private grading criteria and storage fields.

Voice follows the same submission path as text. MediaRecorder creates a local recording. Where implemented by the browser, the speech recognition API produces draft text. The candidate inserts and edits that text before submission. Speech synthesis reads the prompt, and browser audio controls play the recording. There is no server-side storage for recordings.

## MongoDB model

| Collection | Important fields and indexes |
| --- | --- |
| `users` | UUID, unique normalized email, name, candidate role, scrypt hash, voice preference, creation date |
| `refresh_sessions` | UUID, owner, current token hash, bounded rotated hashes, revocation flag, TTL expiry |
| `resumes` | UUID, owner, label, reviewed skill names and creation cursor. Indexed by owner and cursor. |
| `role_analyses` | UUID, owner, optional resume ID, role title, required and preferred skills, matches, gaps and topics. Indexed by owner and cursor. |
| `interview_sessions` | UUID, owner, unique owner/create key, provider and model, rubric version, settings, plan, revision, current prompt, immutable turns, idempotency records, scoring and report lease state. Indexed for history, comparable scores and report work. |

Each interview holds at most six planned questions and one follow-up per planned question. A saved answer binds to the exact prompt ID and active revision. One conditional MongoDB update advances the revision, appends the immutable answer, and records its idempotency key. A retry with the same input returns the latest version of the same committed session. An answer for a stale revision or completed session returns a conflict. Future questions and assessment criteria stay private.

Session time starts after the first question is available. A read or mutation reconciles deadline expiry. Finishing an interview schedules report work in the same atomic write. A worker leases one job, evaluates one saved answer, verifies its evidence and writes progress under its lease. A later worker can reclaim an expired lease. Report attempts use bounded retries and backoff. Candidates can request another set of attempts for failed answers while preserving available feedback.

## Coaching and scoring

The seven dimensions are technical accuracy, conceptual understanding, problem solving, communication clarity, completeness, reasoning and relevance. Each dimension uses an anchor appropriate to the prompt and chosen difficulty.

| Score | Anchor |
| --- | --- |
| 0 | A verifiable incorrect or off-target attempt |
| 1 | A limited demonstration with important omissions |
| 2 | A partial demonstration with an identifiable relevant point |
| 3 | A solid demonstration appropriate to the selected level |
| 4 | A thorough demonstration with strong justification or coverage |

The provider proposes structured grades and supporting excerpts. The server verifies each quote against the immutable answer and records the original UTF-16 start and end offsets. Incorrect and ambiguous quotes are rejected. An absent dimension or skipped answer stays unscored. The report averages answered scores per dimension, then weights scored dimensions equally for the overall percentage. Coverage and graded answer counts appear alongside the score. The local adapter estimates only limited clarity and completeness signals with explicit heuristic rationales. Trends use comparable completed reports on the current provider, model, track, difficulty and rubric version.

## Privacy and trust boundaries

Passwords use per-account salts, Node’s scrypt implementation and constant-time comparison. Access JWTs expire in 15 minutes and remain in browser memory. Refresh credentials rotate in an HttpOnly cookie and the database stores token hashes. Session revocation invalidates access immediately. Origin checks cover cookie-authenticated actions. Private queries scope records to the authenticated owner. The API applies IP and authenticated-account rate limits.

PDFs are limited to 5 MB and 15 pages and go to a separate short-lived parser process with a memory and time budget. The process receives a reduced environment and the file bytes. Raw file bytes and extracted prose are discarded. The browser only displays a saved skill profile. User-provided context is model data, with bounded size and no runtime authority. Plain text rendering and a content security policy protect the UI from generated markup.

The server uses a new collection layout in the same application. Legacy prototype records had no trusted owner field. Existing records require an explicit ownership mapping before they can be imported.
