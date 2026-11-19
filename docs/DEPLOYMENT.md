# Deployment and operations

## Vercel and MongoDB Atlas

Import the GitHub repository with the repository root as the Vercel root directory and Node.js 24. The checked-in `vercel.json` builds the client and backend, serves static assets, and routes API requests to `api/index.mjs`. The function runs in Mumbai (`bom1`) to match the Atlas cluster.

The function bundle explicitly includes the PDF parsing worker, PDF.js, and its native canvas dependencies. The parser runs in a child process, so its dependencies must be included even when automatic tracing does not discover them from the API entry point.

Set these server environment variables before activating the deployment.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATA_STORE` | `mongo` |
| `MONGO_URI` | Atlas connection string with the application database |
| `JWT_SECRET` | A stable random secret of at least 32 characters |
| `APP_ORIGIN` | The exact public HTTPS origin used to open the site |
| `SECURE_COOKIES` | `true` |
| `TRUST_PROXY` | The deployment's proxy hop count |
| `AI_PROVIDER` | `openrouter` |
| `AI_MODEL` | A tool-calling model available to the OpenRouter account |
| `OPENROUTER_API_KEY` | Server-side OpenRouter key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `AI_TIMEOUT_MS` | `45000` |
| `GOOGLE_API_KEY` | Server-side Gemini speech API key |
| `AUDIO_TRANSCRIPTION_PROVIDER` | `gemini` |
| `AUDIO_TRANSCRIPTION_MODEL` | `gemini-3.5-transcribe` |

Use the matching origin and database for preview environments. Configure Atlas network access for Vercel and scope the database user to the application database. Each function instance reuses its MongoDB connection. Submissions and report polls schedule report processing through `waitUntil`, with MongoDB leases coordinating concurrent instances.

Gemini verifies complete answer recordings with interview vocabulary before submission. Verbatim mode preserves filler words and repetitions for coaching, and requests set `store=false`. Browser captions remain provisional. Speech can also use OpenAI by setting `AUDIO_TRANSCRIPTION_PROVIDER=openai`, a supported transcription model, and `OPENAI_API_KEY`. The NVIDIA free endpoint restricts personal and confidential data, so evaluate it with fictional interviews and choose a production model consistent with the site's data use.

Verify readiness, sign-up, resumed sign-in, resume upload, role analysis, final speech transcription, and report completion after deployment. Uploads are limited to 4 MB so multipart requests fit within Vercel's request-body limit.

## Docker Compose

Use Docker Compose for the local application and MongoDB. Put your secret in the root `.env`, then run:

```bash
docker compose up --build
```

Open [localhost:3000](http://localhost:3000). The MongoDB service is private to the Compose network, and its data volume survives service restarts. Keep that volume for local persistence, and back it up before recreating the database.

The application image serves the production React build and Express on port 3000. Set these variables when deploying it outside the local Compose stack:

| Variable | Production setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | Exact public HTTPS origin used by the browser |
| `MONGO_URI` | Authenticated MongoDB database URL |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `SECURE_COOKIES` | `true` |
| `TRUST_PROXY` | Number of trusted proxy hops, or `0` when direct |
| `AI_PROVIDER`, `AI_MODEL` | Select a supported adapter and model, or use `local` |
| `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OLLAMA_URL` | Set only the credentials and URL needed by your provider |

Terminate HTTPS at the reverse proxy and use the readiness endpoint to gate traffic. The application fails startup on invalid required settings. Configure a MongoDB backup schedule and an environment retention policy for profiles, transcripts, reports and backups. Protect the database URL and the signing secret with deployment-managed secrets. JWT secret rotation signs out existing access tokens until the next refresh.

The default HTTP rate limits are process-local. Use a shared edge rate limit for a multi-replica public deployment. Report processing coordinates through MongoDB leases. Monitor structured request failure and provider error logs, readiness, and delayed reports. Request and worker logs omit transcript, PDF and secret content. Report jobs created under an unavailable provider/model resume once that configuration is restored.

GitHub Actions verifies type checks, MongoDB-backed API tests, the Vite build, browser tests and the image build. The manual **Publish verified container** workflow uploads a commit-tagged image to the repository’s GitHub Container Registry. Deploy that image through your hosting environment with external TLS and MongoDB, and retain the last known good tag for rollback.
