# InterviewForge AI redevelopment plan

Phase 1 source review · 17 November 2026

This document records the source audit and proposed design. The [current README](README.md) describes the delivered in-place implementation.

## 1. Existing application

The archive contains a voice-first mock interview prototype. Its implemented path takes pasted skills and a job description, generates a question list, plays an opening prompt, records spoken responses, transcribes them, asks for clarification where appropriate, and presents feedback and a final summary. MongoDB persists an interview and the browser remembers one session ID. The implementation below was inspected from source. Runtime verification is recorded in §7.

### Folder structure

```text
.
├── .gitignore
├── README.md
├── backend/
│   ├── .gitignore, package.json, server.js
│   ├── src 11-22-52-012                  # Empty file
│   └── src/
│       ├── app.js
│       ├── controllers/                  # interview, transcribe
│       ├── db/                           # MongoDB connection
│       ├── middlewares/                  # Multer disk uploads
│       ├── models/                       # Interview
│       ├── public/                       # Empty public.js
│       ├── routes/                       # interview, transcribe
│       └── services/                     # ollama, scoring, whisper, tts
├── frontend/
│   ├── .gitignore, README.md, index.html, package.json
│   ├── eslint.config.js, vite.config.js
│   ├── public/                           # Starter SVG assets
│   └── src/
│       ├── main.jsx, App.jsx, App.css, index.css
│       ├── Home/                         # Navbar, Form
│       ├── Interview/                    # Interview workspace and results
│       └── assets/                       # Hero image and starter SVGs
└── screenshots/                          # Five README screenshots
```

### Stack and request flow

- **Frontend.** React 19 JSX, Vite 8, Tailwind CSS 4 and native `fetch`. `main.jsx` mounts `App` under `StrictMode`. `App` renders `Navbar`, which includes `Form`. `Form` conditionally switches between setup, loading and the interview component. There is one page with no router, protected navigation, shared API client or server-state cache. `Interview.jsx` owns microphone and playback state, API requests, progress, latest feedback and the result view.
- **Backend.** Node.js CommonJS, Express 5, Mongoose 9, dotenv, CORS and Multer. `server.js` starts database connection and Kokoro warm-up without awaiting either before listening on port 3000. `app.js` mounts the routes, JSON parser, permissive CORS and public WAV serving. The interview controller queries Mongoose directly and coordinates question generation, state, scoring, transcription and playback. The standalone transcription controller calls the same Whisper service.
- **Persistence.** The single `Interview` model stores `resume` (pasted skills), `jd`, a string array of questions, embedded scored answers, the current question index and follow-up count, a `confidence` field reused for the final score, status and a final summary. Answers embed question text, transcript, score, confidence, feedback, strengths and improvements. The schema has no account relationship, per-question stable ID, timestamps, status enum, configured secondary indexes or separately stored follow-up turns.
- **AI and audio.** Ollama `llama3` provides a free-text question list, a JSON-formatted follow-up decision, a JSON-formatted answer evaluation and a prose summary. The decision receives the current question, new transcript and two recent *scored* answers. Scores use numeric coercion and clamping. On disk, the upload goes to a local `whisper-cli` process with an English `base.en` model and Kokoro generates a WAV with the `af_heart` voice. The source hardcodes model names, filesystem paths and audio URLs.
- **Identity and access.** No registration, login, accounts, password hashing, tokens, roles or ownership checks are present. Session reads and writes look up MongoDB IDs supplied by the caller. The local storage key helps the browser find a session, and the API treats possession of that ID as sufficient to access it. Generated audio is publicly served.

| Existing route | Behavior visible in source |
| --- | --- |
| `POST /api/interview/generate` | Accepts `{resume, jd}`, asks for questions, inserts a session, then generates introductory audio. Success returns ID, questions, current question, progress and audio URL. |
| `POST /api/interview/submit-answer` | Accepts multipart `audio` and `sessionId`. Transcribes first, loads the session, decides whether to follow up, then scores and stores the transcript when advancing. Returns a spoken response, progress, feedback and completion data. |
| `POST /api/interview/end` | Accepts `sessionId`, summarizes and completes the session, or returns an already completed session. |
| `GET /api/interview/session/:sessionId` | Rebuilds the current question, latest feedback and completion summary. The frontend calls it on load using one locally stored ID. |
| `POST /audio/transcribe` | Accepts multipart `audio` and returns a transcript. The interview UI submits audio through the interview route. |
| `GET /audio/<file>` | Express serves saved WAV files from `backend/public/audio`. |

### Defects and technical debt

| Priority | Finding and impact | Source |
| --- | --- | --- |
| Critical before deployment | Session reads, answers and completion lack owner scoping. Anyone who obtains an ID can use the session endpoints. Public audio can contain individualized questions and model remarks. Apply authentication, owner-scoped queries and private or transient media. | [Express app](backend/src/app.js), [interview controller](backend/src/controllers/interview.controller.js) |
| Critical before deployment | Disk uploads lack file size and format limits, enforced retention and rate limits. Transcription runs before session lookup, and the subprocess has no explicit timeout. Open CORS and uncapped expensive work create additional abuse and capacity risks. Enforce validation and admission limits before processing. | [Upload middleware](backend/src/middlewares/upload.middleware.js), [Whisper service](backend/src/services/whisper.service.js), [interview controller](backend/src/controllers/interview.controller.js) |
| High | Follow-up replies are transient. On a clarification branch, only the counter is saved. The user's first transcript and the new follow-up prompt are lost on refresh, and the next answer is still evaluated against the base question. | [Interview controller](backend/src/controllers/interview.controller.js) |
| High | Answer and completion mutations have no expected question ID, revision check, duplicate key or completed-session guard on submission. Retries and concurrent writes can advance stale state. TTS can fail after an interview insert or state update, leaving a persisted success behind a failed response. Final summary generation can also prevent a terminal state from being saved. | [Interview controller](backend/src/controllers/interview.controller.js) |
| High | Question generation filters free text for lines with `?`, so the count can drift or yield an empty plan. Follow-up and grading JSON is loosely coerced, including truthiness conversion of the decision and zero substitution for invalid scores. Candidate and job text enter prompts without clear instruction/data boundaries. Use strict schemas and independent domain checks. | [Ollama service](backend/src/services/ollama.service.js), [interview controller](backend/src/controllers/interview.controller.js), [scoring service](backend/src/services/scoring.service.js) |
| High | Overall score divides by all planned questions, implicitly treating early exit as zero on unattempted questions. The score lacks verified answer evidence. The uncertainty heuristic strips punctuation before matching, can miss contractions and can classify a substantive answer as uncertain on a broad keyword. Keep coverage separate from scoring. | [Interview controller](backend/src/controllers/interview.controller.js), [scoring service](backend/src/services/scoring.service.js) |
| High | The frontend imports `lucide-react` without declaring it, and `Form.jsx` requests an unused named `React` export from `react`. The clean build is unverified. The README's Node 18 prerequisite conflicts with declared Vite and Mongoose major versions. [Vite 8 announcement](https://vite.dev/blog/announcing-vite8) · [Mongoose 9 migration guide](https://mongoosejs.com/docs/migrating_to_9.html) | [Frontend manifest](frontend/package.json), [form](frontend/src/Home/Form.jsx), [workspace](frontend/src/Interview/Interview.jsx), [README](README.md) |
| High | The frontend labels recordings as WebM and passes them to a working-directory-relative Whisper binary without decoding or format negotiation. The documented default CLI setup expects WAV, while optional FFmpeg support can broaden decoding. The archive omits the binary, model and the directories used for uploads and WAV output. [Whisper documentation](https://github.com/ggml-org/whisper.cpp) | [Workspace](frontend/src/Interview/Interview.jsx), [Whisper service](backend/src/services/whisper.service.js), [TTS service](backend/src/services/tts.service.js), [README](README.md) |
| Medium | Local storage is cleared on any restore failure, including a transient outage. The workspace duplicates server state, replays audio when `interviewData` changes and has no media cleanup on unmount. The camera toggle changes the icon without capturing video. | [Form](frontend/src/Home/Form.jsx), [workspace](frontend/src/Interview/Interview.jsx) |
| Medium | Hardcoded localhost, port and paths couple deployment to local setup. MongoDB startup errors are logged without failing startup. End-to-end latency includes transcription, model calls and synthesis, with no explicit time budgets or bounded concurrency. Finalization sends accumulated transcripts back to the model. Some 500s expose raw error messages. | [Server entry](backend/server.js), [DB connection](backend/src/db/db.js), [interview controller](backend/src/controllers/interview.controller.js) |

## 2. Product scope and what to rebuild

| Area | Retain as a product idea | InterviewForge AI implementation |
| --- | --- | --- |
| Interview preparation | Tailor practice to a target role and skill profile. | Parse PDFs, offer candidate review of extracted skills, compare job requirements to demonstrated skills, and prioritize interview topics. Include a general practice path with optional resume context. |
| Interview workspace | Show the active question and progress, ask clarifying questions and resume later. | Build an original, responsive text-first workspace with persisted turns, server-owned progression, explicit retry and a durable route for resuming. Include frontend, backend, MERN, JS/TS, system design and behavioral tracks, difficulty selection and a time budget. |
| Coaching | Give actionable feedback and a final summary. | Build a versioned seven-dimension rubric, verified quotations, per-answer feedback, coverage and an interview history with comparable trends. |
| Voice practice | Allow candidates to speak their answers and hear interviewer prompts. | Add optional voice to the same text flow once it is reliable. Offer editable transcripts before submission, permission and error states, and explicit playback controls. |
| Account and navigation | Start a session from a setup screen. | Add a protected dashboard, interview creation, live workspace, resume library, history, reports and profile settings with a reusable, accessible design system. Registration, login and account ownership are new. |

The strongest portfolio demonstrations are a two-tab or lost-response submission that records exactly one answer, a resume-to-question flow that explains the role requirements it prioritized, and a report that allows a reviewer to click every score's evidence and see the exact original answer span. Use these as end-to-end acceptance scenarios.

## 3. Proposed architecture

- **Client.** React, TypeScript, Vite, Tailwind CSS, React Router and TanStack Query. Use routes such as `/login`, `/dashboard`, `/interviews/new`, `/interviews/:id`, `/interviews/:id/report`, `/history`, `/resumes` and `/settings`. A typed API client handles request errors and coordinated refresh. Query data owns server state, and the workspace holds the editable answer locally until the server acknowledges it. Scope cache entries by account and clear them on logout. Provide keyboard navigation, visible focus, live status messages and explicit empty, loading and retry states.
- **Server.** Node.js 24 LTS, Express and TypeScript. Organize around auth, profile, resumes, role analysis, interviews and reports. Routes compose validation, authentication and limits. Controllers translate HTTP to service calls. Services own state transitions and AI orchestration. Use repositories for owner-scoped queries, atomic transitions and report job claims. A small shared workspace package holds Zod contracts and inferred types, with candidate-facing DTOs distinct from internal persistence models. Pin a supported Node version, use a committed npm lockfile, and verify peer dependencies with a clean install before adopting package versions. [Node.js release status](https://nodejs.org/en/about/previous-releases)
- **Authentication.** Use Argon2id password hashing, short-lived signed access JWTs held in memory, and rotating opaque refresh tokens in same-origin `HttpOnly`, `Secure` production cookies. Store only hashed refresh credentials and expiry. Validate issuer, audience, expiry and algorithm, revoke the refresh session at logout, reject replayed tokens, and coordinate refresh across tabs. Enforce origin checks on cookie-authenticated mutations and rate-limit sign-in by account and IP. Candidate operations are scoped by authenticated owner ID. Reserve role checks for privileged routes if introduced and keep self-registration at the candidate role.
- **Resume and job analysis.** Start with PDF-only uploads, an initial 5 MiB limit, signature and parser checks, and page/time/extracted-text bounds. Run extraction in an isolated process with bounded memory/work and clean up originals after processing. Return a clear error for scanned PDFs that lack extractable text. Save only candidate-approved skill details and source labels needed for review. Distinguish required and preferred job skills, matched skills and gaps in documented evidence. Disclose provider processing before submission and send only the relevant extracts with contact details removed where practical.
- **AI orchestration.** Compose LangChain.js calls on the server for role analysis, interview planning, follow-up generation and evaluation. Implement one real provider first, then use the same contract for the second adapter. Set provider, model, timeouts and keys through server environment variables. Pin compatible model and package versions after verifying schema support. Use provider structured output plus server-side Zod and domain validation. Treat job descriptions, resumes and transcripts as untrusted data in prompts. Pass the relevant role context, current question, a bounded window of recent turns and covered question intents. Set input, output, concurrency and retry budgets. Log request ID, timing, provider/model and outcome without storing prompt bodies in logs. [LangChain Gemini integration](https://docs.langchain.com/oss/javascript/integrations/chat/google) · [LangChain OpenAI integration](https://docs.langchain.com/oss/javascript/integrations/chat/openai)
- **Voice.** Build a browser recording hook, a server transcription adapter and a speech playback adapter. Detect actual MediaRecorder MIME support, validate and normalize containers server-side when required, and transcribe to an editable draft in the workspace. Validate ownership before media processing, cap duration and size, delete temporary media in success and failure paths, and allow text entry if permissions or speech services fail. Start with browser speech synthesis and accessible play, pause and stop controls.
- **Deployment.** Use Docker multi-stage builds and Docker Compose for local app and MongoDB. Serve the client and API behind one HTTPS origin in production. Validate configuration at startup, provide liveness and database readiness, and keep credentials in environment secrets. Use GitHub Actions for checks on pull requests, then build a container for approved releases. Configure publishing and deployment after a target is selected. Track ownership errors, rate limits, provider failures, latency and report queue age through structured logs and metrics.

### Interview state and reliability

1. **Create.** Validate the six tracks, difficulty, allowed duration and optional owned role analysis. Generate a bounded question plan with canonical topics, intent and assessment criteria. Require a minimum valid question count. Deduplicate normalized question text and filter near-duplicates using intent/topic checks before storing the plan. Expose the current question while keeping future prompts and assessment criteria server-side. Begin a server-timed practice window when the opening question is committed. A resumed interview uses that same deadline.
2. **Submit.** Validate a nonblank answer, `questionId`, `expectedRevision` and an `Idempotency-Key`. Model an explicit skip as its own action and record it as unscored. Check ownership and look for a prior result before invoking AI. Select at most one bounded follow-up per planned question and deduplicate against earlier prompts. Use the next planned question if the follow-up result is unavailable or invalid. An atomic update conditioned on owner, current question, revision, active status and deadline commits the immutable submission, follow-up or next question, and idempotency result together. Concurrent requests that fail the update read the committed result or get a conflict and refresh. The MVP can tolerate duplicate provider work during a race. State advances once.
3. **Resume and finish.** The workspace loads persisted turns, active prompt, coverage and deadline from the server. Use one transition for manual finish, exhaustion and timeout. Once the timebox expires, the next request to the session reconciles its terminal state and exposes saved work. Submissions that miss the deadline are rejected. Write terminal state and pending report work together. For sessions with zero submitted answers, return a completed report with zero coverage and no numeric score.
4. **Evaluate.** A small worker leases pending or retryable report work from MongoDB and persists per-answer progress. It uses bounded timeouts and retry backoff for transient failures. Leases expire after interruption, and only the current lease holder can commit work. Build the report from persisted evaluations and distinguish pending, partial, ready and failed states. Report presentation and trend queries consume the same aggregates.

### Rubric and evidence

Use a versioned 0–4 coaching scale. Define anchors per dimension starting with `0` for an evidenced incorrect or off-target attempt, `2` for a partial demonstration and `4` for a correct or thorough demonstration at the chosen level. Publish examples for all five levels and track-specific applicability.

| Dimension | What the evaluator examines |
| --- | --- |
| Technical accuracy | Correctness of material technical claims and predictions. |
| Conceptual understanding | Explanation of mechanisms and relationships between concepts. |
| Problem-solving ability | A feasible approach, decomposition and handling of constraints. |
| Communication clarity | Organization and precision of the candidate's explanation. |
| Completeness | Coverage of the requested elements and important cases. |
| Reasoning | Justification of choices, trade-offs and assumptions. |
| Relevance | How directly the response addresses the question. |

For each numeric dimension, require an exact excerpt from the immutable answer plus a rationale. Have the server locate the excerpt and persist the answer ID and character span. Resolve repeated matches only with a verified offset or an unambiguous excerpt. If the source check fails, retry once or mark that dimension unevaluated. Display original text from the stored span, and include fixtures to check that rationales interpret evidence accurately. An explicit skip, inapplicable dimension or answer with insufficient evidence stays unscored. Average scored answers within each dimension, then give each scored dimension equal weight for the overall percentage. Report coverage separately and show comparable trends within the same track, difficulty and rubric version. Display the results as coaching feedback, with strengths and improvement recommendations linked to the relevant turns.

## 4. Proposed database design

| Collection | Fields and relationships | Queries and constraints |
| --- | --- | --- |
| `users` | Normalized email, password hash, display name, role, preferences and timestamps. | Unique normalized email. Project hashes out of client-facing data. |
| `refreshSessions` | Owner ID, current token hash, rotation state, expiry and revocation metadata. | Owner/session and expiry indexes. Use expiry checks during authorization as well as TTL cleanup. |
| `resumes` | Owner ID, display label, reviewed skills and selected source snippets, processing state and timestamps. Raw PDFs are temporary. | Index owner and creation time. Support list, review and deletion. |
| `roleAnalyses` | Owner, optional resume ID, role label, bounded job context, canonical requirements, matches, gaps, recommended topics, source labels and analysis version. | Owner-scoped lookup and recent list. Defined retention and removal of saved analyses on request. |
| `interviews` | Owner, optional analysis ID, reduced snapshot of role topics, configuration, `status`, `startedAt`, `deadlineAt`, `completedAt`, `revision`, planned questions, bounded turns, answer IDs, idempotency records, versioned evaluations and report/job state. | Unique owner/create idempotency key; compound indexes for owner/history, owner/track/difficulty/completion and report pending/retry/lease queries. Bound question count, answer size, turns and stored results to keep the aggregate small. |

Embedding the bounded interview record lets answer writes and report scheduling use single-document atomic updates with a standard MongoDB deployment. Reports and trends can read projections from the same collection. Saving a reduced context snapshot means later edits to a resume do not change historical interview results. Expose interview deletion so users can remove the retained transcript, snapshot and report. Define retention for temporary files, records and backups before production deployment.

The prototype has no trusted account ID to map to new owners. Use a new database or namespace for InterviewForge AI. Any later data import needs an explicit ownership mapping, a dry run and user approval before transforming records.

## 5. Proposed API surface

Version under `/api/v1`. Return successful JSON as `{data, meta?}` and failures as `{error: {code, message, details?, requestId}}`. Use Zod for request and response contracts. Scope each private resource lookup to the authenticated owner, validate IDs before querying, and use cursor pagination for lists.

| Method and route | Contract |
| --- | --- |
| `POST /auth/register`, `POST /auth/login` | Validate credentials, return access JWT and set refresh cookie. |
| `POST /auth/refresh`, `POST /auth/logout` | Rotate or revoke refresh credentials. |
| `GET /me`, `PATCH /me` | Read or update allowed profile fields. |
| `GET /resumes`, `POST /resumes`, `GET/PATCH/DELETE /resumes/:id` | List, upload, review and remove owned resume profiles. `POST` accepts PDF multipart and returns the extracted draft. |
| `GET/POST /role-analyses`, `GET/DELETE /role-analyses/:id` | Analyze a pasted job description against optional owned resume skills, list or load results, and delete them. |
| `POST /interviews` | Accepts track, difficulty, duration, optional role analysis ID and `Idempotency-Key`. Returns `201` with the initial session. |
| `GET /interviews`, `GET/DELETE /interviews/:id` | List history, resume or review persisted work, or delete the owned record. |
| `POST /interviews/:id/answers` | Accepts `questionId`, `expectedRevision` and either nonblank answer text or an explicit skip, with an `Idempotency-Key`. Same key and payload replay the committed result. A changed payload with that key, stale revision or closed session returns `409`. |
| `POST /interviews/:id/finish` | Idempotently closes a session and schedules report work if there are answers to evaluate. |
| `GET /interviews/:id/report`, `POST /interviews/:id/report/retry` | Read report or processing status, and retry eligible failed work without changing the interview. |
| `GET /metrics/interview-trends` | Summarize completed comparable sessions by track, difficulty and rubric version. Include sample counts and coverage. |
| `POST /interviews/:id/transcriptions` | Optional voice endpoint. Returns a draft transcript for candidate review and normal text submission. |

Use `400` for invalid input, `401` for missing or invalid credentials, `404` for absent or out-of-scope resources, `413`/`415` for upload limits and format, and `429` for application rate limits. Map upstream unavailability and timeouts to controlled retryable responses, with `Retry-After` when known. Provider errors in report jobs appear through job status.

## 6. Recommended implementation order

| Stage | Deliverable and verification before continuing |
| --- | --- |
| 1. Foundation | After approval, scaffold an independently authored TypeScript client/server and shared contracts. Set up Node/npm pinning, lockfile, validated environment, error shape, health checks, Docker and baseline CI. A clean install, lint, type check and build pass. |
| 2. Identity | Deliver registration, login, refresh, logout, protected navigation and owner-scoped APIs. Verify owner isolation using two users and exercise expired and replayed credentials. |
| 3. Text interview | Build question planning, text entry, stored turns and follow-ups, target duration, safe retry, resume and completion. Run first with a deterministic test provider, then verify one real configured provider against a small synthetic fixture. Demonstrate double-submit, reload after follow-up and reconnect after a committed answer. |
| 4. Resume and role context | Add private PDF ingestion, reviewed skills, pasted job descriptions, gap analysis and personalized question and topic selection. Verify upload rejection and cleanup as well as context reaching the planner. |
| 5. Evaluation and reports | Add the rubric, source-span verification, persisted report work, accessible report and trend dashboard. Use fixtures that intentionally return fabricated evidence and simulate a worker restart. Verify reopened reports reproduce the same scores and coverage. |
| 6. Voice | After stable text interviews, add microphone recording, editable speech-to-text, playback controls and voice failure recovery. Run browser permission and simulated-media tests, then smoke test a real device. |
| 7. Release | Complete README, setup and `.env.example`, architecture/API/schema documentation, testing and deployment runbooks, and attribution and dependency notices. Verify clean-container setup, the critical workflow, redacted logs and reproducible release artifacts. |

## 7. Testing strategy and Phase 1 verification

- **Vitest unit tests.** Test transitions, timebox boundaries, context selection and question deduplication, Zod provider contracts, invalid evidence, incorrect evidence offsets, score aggregation and partial coverage. Inject malformed responses, provider timeouts and rate limits with deterministic model adapters. Include a small rubric calibration set with documented human expectations.
- **Supertest and MongoDB integration.** Use a disposable MongoDB service for route integration and atomicity tests. Exercise registration/login, auth expiry, refresh replay, two-user isolation, invalid input and provider errors. Test simultaneous submissions, changed idempotent payload, finish versus submit, durable retries and worker leases. Check that a failed register or mutation leaves consistent persisted state, and that uploads are cleaned up on both accepted and rejected paths. Verify missing production secrets fail startup.
- **React Testing Library.** Test protected routes, resume and report states, keyboard navigation, retry after a network error, answer draft retention and transcript editing with mocked network and media. Verify auth cache is cleared and stale session writes show recovery UI.
- **Playwright.** Run registration → resume upload and role analysis → personalized text interview → refresh on a follow-up → completion → evidence drill-down and history. Add a network interruption case that replays a committed answer and a voice-permission-denied case that falls back to text. Use fake LLM and media for deterministic CI. Keep real-provider and physical microphone checks opt-in and use synthetic content.
- **CI.** Run `npm ci`, lint, type check, unit and API tests, build and run critical browser flows against a local test stack on pull requests. Upload Playwright traces on failure. For releases, build the image, record dependency/license metadata and check dependency advisories against the resolved graph.

**Phase 1 baseline.** The archive has no `.git` metadata, test files, test runner, dependency lockfile, `.github/workflows`, Docker configuration or checked-in environment template. The backend `test` script is a placeholder that exits with code 1, and the frontend has build and ESLint scripts only. `node --check` passed for all 14 backend JavaScript files with local Node v24.19.0. A frontend build, runtime tests and live MongoDB/Ollama/Whisper/Kokoro behavior were unverified. No dependencies were installed or services started.

## 8. Provenance and dependency licensing

The archive matches the project name, README and top-level tree of Yatnesh Agarwal's `AI_Interview_Prep` public repository. No `LICENSE`, `COPYING` or `NOTICE` file was found in the archive, and the public default branch shows no repository-wide license. The root README calls the project open source and `backend/package.json` declares `ISC` with an empty author field. The scope and applicable copyright notice for that package declaration could not be established from the snapshot. Use the prototype as a reference and author the new code, prompts, docs and visuals independently. Credit the upstream author and link the project in the new README. Confirm permission and preserve any applicable license and copyright notices before reusing or redistributing upstream material. [Upstream repository](https://github.com/yatnesh-agarwal/AI_Interview_Prep) · [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

The following is a preliminary review of the declared direct dependencies, based on publishers' package metadata or project licenses. The original ranges were never resolved here, so a complete inventory of shipped versions, transitive licenses and notices remains a release task.

| Dependency group | Publisher license and source |
| --- | --- |
| HTTP and database libraries | MIT for Axios, CORS, Express, Mongoose and Multer. [Axios](https://github.com/axios/axios/blob/v1.16.1/package.json) · [CORS](https://github.com/expressjs/cors/blob/master/package.json) · [Express](https://github.com/expressjs/express/blob/v5.2.1/package.json) · [Mongoose](https://github.com/Automattic/mongoose) · [Multer](https://github.com/expressjs/multer/blob/main/package.json) |
| dotenv | BSD-2-Clause. [dotenv manifest](https://github.com/motdotla/dotenv/blob/master/package.json) |
| AI and audio libraries | MIT for the `ollama` JS client and `whisper.cpp` npm package. Apache-2.0 for `kokoro-js`. [Ollama JS](https://github.com/ollama/ollama-js/blob/main/package.json) · [Whisper npm manifest](https://cdn.jsdelivr.net/npm/whisper.cpp@1.0.3/package.json) · [Kokoro npm manifest](https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/package.json) |
| UI runtime | MIT for React/ReactDOM, Tailwind and its Vite plugin, and the declared audio recorder. `lucide-react` is imported without a declared version. Its upstream license includes ISC and MIT notices. [React](https://github.com/react/react/blob/main/LICENSE) · [Tailwind](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE) · [Audio recorder](https://github.com/samhirtarif/react-audio-recorder/blob/master/package.json) · [Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE) |
| Frontend tooling | MIT at upstream-project level for Vite, its React plugin, React/ReactDOM type packages, ESLint and `@eslint/js`, the React Hooks and React Refresh ESLint plugins, and `globals`. Bundled code may carry additional notices. [Vite](https://github.com/vitejs/vite/blob/main/packages/vite/LICENSE.md) · [Vite React](https://github.com/vitejs/vite-plugin-react/blob/main/LICENSE) · [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE) · [ESLint](https://github.com/eslint/eslint/blob/main/LICENSE) · [React Hooks](https://github.com/react/react/blob/main/packages/eslint-plugin-react-hooks/package.json) · [React Refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh/blob/main/LICENSE) · [globals](https://github.com/sindresorhus/globals/blob/main/license) |
| External runtimes and weights | MongoDB Community Server is separately licensed under SSPL. Whisper's source and original weights use MIT. The downloaded Kokoro ONNX model card declares Apache-2.0. Ollama's `llama3` weights use the Meta Llama 3 Community License, including model-specific redistribution and attribution terms. [MongoDB](https://www.mongodb.com/legal/licensing/server-side-public-license) · [Whisper CLI](https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE) · [Whisper weights](https://github.com/openai/whisper#license) · [Kokoro ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) · [Llama 3 weights](https://ollama.com/library/llama3/blobs/4fa551d4f938) |

Before distribution, generate a resolved dependency and license inventory and include required notices for npm packages, container layers, native binaries, models and visual assets that ship. The legacy screenshots, hero image and remote setup illustration lack verified reuse terms in the archive. Use original or separately licensed assets for InterviewForge AI.

Implementation proceeded in the existing checkout after the user authorized all phases.
