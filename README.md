# Sadhana Prep

Sadhana Prep is an in-place redevelopment of the AI Interview Prep repository. Set up a technical or behavioral interview, practice by text or voice, and review coaching feedback with excerpts from your submitted answers.

## Run locally

Install **Node.js 24 LTS** and npm. From the repository root:

```bash
npm ci
npm run demo
```

Open [Sadhana Prep](http://localhost:3002) to view the homepage and browse **Preparation**. Sign in with your email and password, or choose **Sign up** to create an account. The launcher loads the root `.env` and uses the configured database and AI provider. With `DATA_STORE=mongo` and `MONGO_URI`, accounts and interviews persist in MongoDB. With no configuration it uses deterministic practice prompts, rule-based feedback, and process-local memory.

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

For hosted final-transcript verification, set `AUDIO_TRANSCRIPTION_PROVIDER=gemini`, `AUDIO_TRANSCRIPTION_MODEL=gemini-3.5-transcribe`, and `GOOGLE_API_KEY` on the server. Gemini returns verbatim speech with technical vocabulary hints and interaction storage disabled. OpenAI remains available with `AUDIO_TRANSCRIPTION_PROVIDER=openai`, an OpenAI transcription model, and `OPENAI_API_KEY`. **Done answering** sends the complete recording to the selected speech service before submitting the final text. Live captions remain provisional while speaking. Speech and interview coaching providers are configured independently.

## What you can do

- Register, sign in, manage your profile and keep interview data scoped to your account.
- Upload a text-based PDF resume and analyze its actual projects, technologies and experience alongside the target role. A resume is required for every new session.
- Choose Practice interview without a job description, or a role-based track including frontend, backend, Java, Python, DSA, databases, DevOps, cloud, mobile, QA and more. Sessions run for 10, 15, 20, 30 or 45 minutes at Easy, Intermediate or Hard level.
- Analyze the complete setup before starting. Questions are generated one at a time until the time limit, with track questions prioritized and resume/behavioral categories capped. Changed settings or resume content require analysis again. Answers are saved before generating the next question, and generation can be retried.
- Review seven coaching dimensions, answer excerpts, strengths, improvements, coverage, history and comparable results for the selected track and difficulty.
- Hear the full introduction and each question before the microphone opens. Each spoken message appears in chat after playback finishes. Vosk runs English captions locally in the browser, and **Done answering** sends the finished transcript to chat. The first voice session downloads a roughly 41 MB model from the application. You can also type answers in chat.

Sadhana Prep discards PDF files after extraction and saves bounded extracted text with contact details removed, along with skills, for interview analysis. Existing profiles saved without text must be uploaded again. Live English captions run in the browser. When hosted transcription is enabled, the app sends each completed answer recording to the selected Gemini or OpenAI speech provider for final verification. The configured coaching provider receives relevant job details, resume project/experience context, skills and submitted interview answers. Feedback scores are intended for practice.

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


