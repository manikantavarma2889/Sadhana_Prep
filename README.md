# Sadhana Prep

Sadhana Prep is an in-place redevelopment of the AI Interview Prep repository. Set up a technical or behavioral interview, practice by text or voice, and review coaching feedback with excerpts from your submitted answers.

## Run locally

Install **Node.js 24 LTS** and npm. From the repository root:

```bash
npm ci
npm run demo
```

Open [Sadhana Prep](http://localhost:3002) to view the homepage and browse **Preparation**. Sign in with your email and password, or choose **Sign up** to create an account. The launcher loads the root `.env` and uses the configured database and AI provider. With `DATA_STORE=mongo` and `MONGO_URI`, accounts and interviews persist in MongoDB. With no configuration it uses a curated question bank, rule-based feedback, and process-local memory.

Run `npm run build:preview` to build updates for the port 3002 preview. Refresh the page after frontend changes and restart the preview after backend changes.

### Use persistent storage

1. Start MongoDB 8 locally or configure a MongoDB connection.
2. Copy `.env.example` to `.env` in the repository root.
3. Set `MONGO_URI` and generate a `JWT_SECRET` with the command in the example file.
4. Run `npm run dev` and open [the development client](http://localhost:5173). The backend uses port 3000 and Vite proxies API requests.

For a same-origin build, run `npm run build` and set `APP_ORIGIN=http://localhost:3000` in `.env` before `npm start`.

### Google sign-in and password recovery

- Create a [Google OAuth web client](https://developers.google.com/identity/openid-connect/openid-connect#appsetup) and set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in the server environment. Register your app origin followed by `/api/v1/auth/google/callback` as an authorized redirect URI. For the standard preview that URI is `http://localhost:3002/api/v1/auth/google/callback`.
- To deliver recovery emails, set `RESEND_API_KEY` and `PASSWORD_RESET_FROM` using a [verified sending domain in Resend](https://resend.com/docs/dashboard/domains/introduction). Reset email links use the server's configured app origin and expire after 30 minutes.
- Signed-in candidates can change their password in **Settings**. A Google-created account can set its first password using a link sent to its email address. A Google sign-in with the same email as an existing password account directs the user to that account's password sign-in.

### Configure AI coaching

| `AI_PROVIDER` | Requirements |
| --- | --- |
| `local` | No API keys. Uses curated track questions, rule-based follow-ups and limited feedback. |
| `gemini` | `GOOGLE_API_KEY` and a Gemini model in `AI_MODEL` that supports structured output. |
| `openai` | `OPENAI_API_KEY` and an OpenAI model in `AI_MODEL` that supports structured output. |
| `openrouter` | `OPENROUTER_API_KEY`, `AI_MODEL`, and `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`. The adapter uses LangChain tool calling for validated structured output. |
| `ollama` | A running Ollama server, `OLLAMA_URL` and a downloaded model in `AI_MODEL` that supports structured output. |

The cloud and Ollama adapters use LangChain. Keep credentials in the server environment. The application checks model configuration at startup. Changing providers or models leaves existing interviews accessible. Pending evaluation work uses the configuration under which the interview was created.

For OpenRouter, choose a model that supports tool calling and set an appropriate `AI_TIMEOUT_MS`, up to 45000. Free model endpoints have provider-specific usage and data policies. Use fictional interview data when evaluating `nvidia/nemotron-3.5-lightning:free`.

For hosted final-transcript verification, configure `OPENAI_API_KEY` and `AUDIO_TRANSCRIPTION_MODEL` on the server. **Done answering** sends the complete recording to that speech service with interview vocabulary before submitting the final text. Live captions remain provisional while speaking.

## What you can do

- Register, sign in, manage your profile and keep interview data scoped to your account.
- Upload a text-based PDF resume, review the extracted skills, and compare them against a job description. Use the analysis to prioritize questions.
- Practice frontend, backend, MERN, JavaScript/TypeScript, system design or behavioral interviews at three difficulty levels for 10, 20, 30 or 45 minutes.
- Answer, skip, take a follow-up, finish early, or resume submitted work before the deadline. A refresh restores the active prompt and saved turns.
- Review seven coaching dimensions, answer excerpts, strengths, improvements, coverage, history and comparable results for the selected track and difficulty.
- Hear the full introduction and each question before the microphone opens. Each spoken message appears in chat after playback finishes. Vosk runs English captions locally in the browser, and **Done answering** sends the finished transcript to chat. The first voice session downloads a roughly 41 MB model from the application. You can also type answers in chat.

Sadhana Prep discards PDF files after extraction and saves the skill profile. The browser may use a speech service for live transcription. To enable backup transcription after recording, set `AUDIO_TRANSCRIPTION_MODEL=gpt-transcribe` and `OPENAI_API_KEY` on the server. When enabled, the app sends the recording to OpenAI only if the browser fails to complete the transcript. The configured AI provider receives relevant job details, skill names and submitted interview answers for coaching. Feedback scores are intended for practice.

## Verify and deploy

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The tests use a synthetic resume and a local coaching adapter. Set `TEST_MONGO_URI` to a disposable MongoDB instance to run the API tests against real MongoDB. The suite creates and removes a database with a generated `forge_test_` name. On Windows, PowerShell users can set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` to run Playwright with an installed Edge browser.

For Docker Compose, configure `JWT_SECRET` in the root `.env` and run `docker compose up --build`. The application is available on [localhost:3000](http://localhost:3000) and MongoDB uses a named volume. See the deployment guide for HTTPS settings and image publication.

- [Architecture, database and rubric](docs/ARCHITECTURE.md)
- [API contracts](docs/API.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Original source audit](REDEVELOPMENT_PLAN.md)

## Attribution

This project builds on the interview practice workflow of Yatnesh Agarwal’s [AI Interview Prep](https://github.com/yatnesh-agarwal/AI_Interview_Prep). The redevelopment replaces the original runtime with a TypeScript implementation in its existing frontend and backend folders. The current build uses the reworked UI and browser-based voice controls. The archived prototype and upstream repository keep the original UI and local Whisper/Kokoro workflow for reference.

The downloaded project did not include a repository-wide license. The original backend manifest identified ISC, and the scope of that declaration was unclear. See the source audit for provenance and dependency licensing. Preserve applicable upstream and third-party notices when redistributing material from those projects.

