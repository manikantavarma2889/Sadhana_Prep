# Deployment and operations

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
