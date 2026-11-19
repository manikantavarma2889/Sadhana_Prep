# API reference

Base path is `/api/v1`. Successful JSON responses wrap results in `{ "data": … }`. Errors use `{ "error": { "code": …, "message": …, "requestId": … } }`. Deletions and logout return `204`. Authentication actions require the configured same-origin `Origin` header. Send the access token as `Authorization: Bearer <token>` for private endpoints.

## Auth and profile

| Method | Path | Input or result |
| --- | --- | --- |
| POST | `/auth/register` | Name, email and password of at least 12 characters. Sets a refresh cookie and returns user and access token. |
| POST | `/auth/login` | Email and password. Sets a refresh cookie and returns user and access token. |
| POST | `/auth/refresh` | Rotates the refresh cookie and returns a new access token. |
| POST | `/auth/logout` | Revokes the current refresh session and clears the cookie. |
| GET | `/me` | Current user, role and voice preference. |
| PATCH | `/me` | Accepts optional `name` and `voiceEnabled`. |

## Resume and role analysis

| Method | Path | Input or result |
| --- | --- | --- |
| GET | `/resumes` | Cursor-paginated resume profiles. |
| POST | `/resumes` | Multipart field `resume` containing a PDF. |
| GET, PATCH, DELETE | `/resumes/:id` | Read, replace label and skills, or delete one owned profile. |
| GET, POST | `/role-analyses` | List analyses or create one using `title`, `description` and optional `resumeId`. |
| GET, DELETE | `/role-analyses/:id` | Read or delete a saved analysis. |

List endpoints accept an optional `cursor` query parameter and return `{ items, nextCursor }`. When present, send `nextCursor` on the next request.

## Interview and reports

| Method | Path | Input or result |
| --- | --- | --- |
| GET | `/interviews` | Cursor-paginated interview history. |
| POST | `/interviews` | Requires `Idempotency-Key`. Accepts `track`, `difficulty`, `minutes` and optional `analysisId`. |
| GET, DELETE | `/interviews/:id` | Resume or review persisted work, or delete the interview and associated report. |
| POST | `/interviews/:id/answers` | Requires `Idempotency-Key`. Accepts `questionId`, `expectedRevision`, `action: "answer"` and `text`, or `action: "skip"` without text. |
| POST | `/interviews/:id/finish` | Finish or return the existing terminal session. |
| GET | `/interviews/:id/report` | Report state, dimensions, aggregate score, coverage and verified answer evidence. |
| POST | `/interviews/:id/report/retry` | Reschedules eligible report work. |
| GET | `/metrics/interview-trends` | Filter by `track` and `difficulty` to return up to 20 comparable scores. |

Tracks are `frontend`, `backend`, `mern`, `javascript`, `system-design` and `behavioral`. Difficulties are `foundation`, `intermediate` and `advanced`. Allowed durations are 10, 20, 30 and 45 minutes. Idempotency keys use 12–100 ASCII letters, numbers, underscores or hyphens. Reusing a key with different input returns `409`. A safe retry returns the current state of the original session.

Invalid data uses `400`, unauthorized requests use `401`, missing or unowned resources use `404`, unsupported uploads use `415`, oversized uploads use `413`, rate limits use `429` and unavailable model calls use `503`.

`/health/live` reports process liveness and `/health/ready` reports database connection readiness. Both are outside the versioned API.
