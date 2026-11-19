<p align="center">
  <a href="https://sadhana-prep.vercel.app">
    <img src="frontend/src/assets/sadhana-prep-favicon.png" alt="Sadhana Prep logo" width="128" height="128">
  </a>
</p>

<h1 align="center">Sadhana Prep</h1>

<p align="center"><strong>Study the fundamentals. Rehearse for the role.</strong></p>

<p align="center">
  <a href="https://sadhana-prep.vercel.app">Live website</a> ·
  <a href="#how-to-run-locally">Local setup</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="ACCESSIBILITY.md">Accessibility</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&amp;logo=react&amp;logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Node.js-24-5FA04E?style=for-the-badge&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/Express-5-353535?style=for-the-badge&amp;logo=express&amp;logoColor=white" alt="Express 5">
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&amp;logo=mongodb&amp;logoColor=white" alt="MongoDB Atlas">
  <br>
  <img src="https://img.shields.io/badge/LangChain-AI-1C3C3C?style=for-the-badge&amp;logo=langchain&amp;logoColor=white" alt="LangChain AI integration">
  <img src="https://img.shields.io/badge/OpenAI-LLM-412991?style=for-the-badge&amp;logo=openai&amp;logoColor=white" alt="OpenAI language models">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&amp;logo=tailwindcss&amp;logoColor=white" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/Vercel-Deployment-000000?style=for-the-badge&amp;logo=vercel&amp;logoColor=white" alt="Deployed on Vercel">
</p>

## What is Sadhana Prep?

Sadhana Prep is a learning and interview preparation platform for students, graduates, and software professionals. It brings computer science foundations, coding practice, system design learning, and personalized AI interview practice into one workspace.

The platform combines a **Prep Hub** for DSA, system design, DBMS, operating systems, and computer networks with **Sadhana**, an AI interviewer. It is a place to build technical understanding, develop confidence explaining ideas, and track progress toward a target role.

## Why Sadhana Prep?

- **Connect learning with practice.** Study a concept, rehearse explaining it, and use feedback to decide what to revisit.
- **Prepare for your own background and goals.** Interview preparation uses your resume, projects, technologies, target role, and job description.
- **Choose the right level and pace.** Practice across 17 interview tracks with Easy, Intermediate, or Hard difficulty and sessions lasting 10, 15, 20, 30, or 45 minutes.
- **Practice speaking or writing.** Use a voice interview with captions or answer through chat.
- **Learn from specific feedback.** Review evidence from your own answers, scoring dimensions, strengths, and suggested improvements.
- **Keep your preparation together.** Return to saved interviews, reports, learning progress, and bookmarked practice material.

## How it works

1. **Explore the preparation tracks.** Browse learning previews for DSA, system design, DBMS, operating systems, and networking. Sign in to access full lessons, exercises, and saved progress.
2. **Configure an interview.** Select a track, enter the role title and job description, choose the difficulty and duration, and upload or select a resume. For subject-only practice, choose **Practice interview** and a subject; the resume is still required.
3. **Analyze the complete setup.** Sadhana analyzes resume projects, technologies, experience, and skills alongside the selected role. Review the summary, relevant topics, skill matches, and gaps. Start becomes available after analysis. Changing the settings or resume requires analysis again.
4. **Meet Sadhana.** Hear the introduction and opening question, then practice technical questions focused on your track and role. Resume and behavioral questions add context in smaller numbers. Questions continue for the selected duration rather than stopping at a fixed count. Easy stays easy; higher levels begin with fundamentals before progressing.
5. **Answer and review.** Speak with live draft captions, then press **Done answering** to submit the final transcript, or type in chat. When configured, a hosted speech service verifies the completed recording before submission. End the session to receive the report.
6. **Plan your next practice session.** Review the overall score, answered-question count, average words per answer, filler words, and session duration. Applicable answers are evaluated across technical accuracy, conceptual understanding, problem solving, communication clarity, completeness, reasoning, and relevance. Feedback includes answer excerpts, explanations, strengths, and improvements.

AI feedback is coaching for practice. It is not a hiring decision or a guaranteed measure of interview performance.

## Tech used

| Area | Technologies and purpose |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, CSS, Framer Motion, and Lucide icons |
| Navigation and data | React Router and TanStack Query |
| Backend | Node.js 24, Express 5, Zod validation, JWT sessions, and scrypt password hashing |
| Database | MongoDB / MongoDB Atlas with Mongoose; an in-memory adapter for local evaluation and tests |
| AI interview and feedback | LangChain with OpenAI LLMs; Google Gemini, Ollama, and a deterministic local adapter are also supported |
| Voice | Vosk browser captions, MediaRecorder, browser speech synthesis, and optional Gemini or OpenAI final transcription |
| Resume processing | PDF.js in a bounded parser process; text-based PDF uploads up to 4 MB |
| Testing | Vitest, Supertest, React Testing Library, and Playwright |
| Hosting and delivery | Vercel, GitHub Actions, and optional Docker Compose |

## How to run locally

### 1. Install the prerequisites

Install **Git** and **Node.js 24**, including npm. Check them in a terminal:

```bash
git --version
node --version
npm --version
```

Node should report `v24.x.x`. MongoDB and external AI credentials are optional for the initial local setup below.

### 2. Clone and install

```bash
git clone https://github.com/manikantavarma2889/Sadhana_Prep.git
cd Sadhana_Prep
npm ci
```

Run all following commands from this repository root, where the main `package.json` is located.

### 3. Create your local environment file

If `.env` already exists, edit it instead of overwriting it.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

Generate a signing secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Open `.env`, paste that generated value into `JWT_SECRET`, and set these values for a local run without external services:

```dotenv
PORT=3002
APP_ORIGIN=http://localhost:3002
DATA_STORE=memory
JWT_SECRET=replace-this-with-the-generated-secret
AI_PROVIDER=local
AI_MODEL=
SECURE_COOKIES=false
```

Keep the other optional credentials empty. Leave `AUDIO_TRANSCRIPTION_MODEL` unset until a hosted speech provider is configured. The `.env` file is ignored by Git.

### 4. Build and start on port 3002

```bash
npm run demo
```

The existing launcher builds the frontend and backend, then serves the website at **[http://localhost:3002](http://localhost:3002)**. It configures the local app origin automatically.

Open **Sign in → Sign up** to create an account. Browse Prep Hub, upload a text-based PDF resume, and try an interview. The local adapter uses curated questions and limited rule-based feedback; external language-model generation requires the optional configuration below.

With `DATA_STORE=memory`, accounts and preparation data disappear when the server stops. Use MongoDB for persistence.

### 5. Stop, edit, and restart

Press **Ctrl+C** in the running terminal to stop the app. After changing source code, run `npm run demo` again to rebuild and start the updated application on port 3002.

If the page does not load, confirm that the terminal shows a successful startup, port 3002 is available, and your `JWT_SECRET` contains at least 32 characters. Readiness is available at [http://localhost:3002/health/ready](http://localhost:3002/health/ready).

### 6. Optional: persist data with MongoDB

Create a MongoDB Atlas database or start a local MongoDB instance. Update `.env`:

```dotenv
DATA_STORE=mongo
MONGO_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/sadhana_prep
```

For a local MongoDB server, use `mongodb://127.0.0.1:27017/sadhana_prep` instead. For Atlas, grant the application user access to the application database and allow connections from the machine running the app. Use a URL-encoded password in the connection string.

Keep `JWT_SECRET` stable, restart with `npm run demo`, and new accounts and interviews will persist in MongoDB. Switching from memory storage does not migrate its temporary accounts.

### 7. Optional: connect real AI and speech providers

**OpenAI LLM for interview questions and feedback:**

```dotenv
AI_PROVIDER=openai
AI_MODEL=your-tool-calling-openai-model-id
OPENAI_API_KEY=your-openai-api-key
AI_TIMEOUT_MS=45000
```

Replace both placeholders with your own valid values. Select a model that supports tool calling and structured responses. Available models and quotas depend on your provider account.

Other supported interview providers are `gemini` with `GOOGLE_API_KEY` and `ollama` with `OLLAMA_URL`. Each requires its model ID in `AI_MODEL`. The cloud and Ollama adapters use LangChain.

**Optional hosted speech-to-text with Gemini:**

```dotenv
AUDIO_TRANSCRIPTION_PROVIDER=gemini
AUDIO_TRANSCRIPTION_MODEL=gemini-3.5-transcribe
GOOGLE_API_KEY=your-google-api-key
```

OpenAI transcription is supported by setting `AUDIO_TRANSCRIPTION_PROVIDER=openai`, a supported transcription model in `AUDIO_TRANSCRIPTION_MODEL`, and `OPENAI_API_KEY`.

Interview generation and speech transcription are configured independently. Live captions are draft text; the completed recording is checked by the configured hosted transcription provider. Browser speech synthesis reads the AI's questions aloud.

Restart the server after editing `.env`. Keep provider keys on the server. The app sends relevant resume/job context and answers to the selected coaching provider, and completed answer audio to a hosted transcription provider only when that feature is configured. Raw PDF uploads are discarded after extraction; bounded resume text is retained with contact details removed.

### 8. Optional: Google sign-in and recovery email

For **Continue with Google**, create a Google OAuth Web application client and set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. Register this local callback:

```text
http://localhost:3002/api/v1/auth/google/callback
```

Email/password registration works without Google credentials. Password recovery emails require `RESEND_API_KEY` and a verified sender in `PASSWORD_RESET_FROM`. See the [deployment guide](docs/DEPLOYMENT.md) for hosted configuration.

## Testing

```bash
npm run typecheck
npm test
npm run build
```

For browser tests, first stop the application using port 3002, then install Playwright's browser:

```bash
npx playwright install chromium
```

**Windows PowerShell:**

```powershell
$env:FORGE_E2E_PORT = "3002"
npm run test:e2e
Remove-Item Env:FORGE_E2E_PORT
```

**macOS / Linux:**

```bash
FORGE_E2E_PORT=3002 npm run test:e2e
```

The browser suite starts its own isolated app on port 3002 with in-memory storage and the local AI adapter. It does not use real provider credentials. Restart normal local practice with `npm run demo` after the tests finish.

See the [test record](docs/TEST_RECORD.md) for recorded results, scope, and remaining checks.

## Documentation

- [Project accessibility statement](ACCESSIBILITY.md#project-accessibility-statement)
- [Accessibility test record](ACCESSIBILITY.md#test-record)
- [Test record and verification scope](docs/TEST_RECORD.md)
- [Architecture, database, and scoring rubric](docs/ARCHITECTURE.md)
- [API contracts](docs/API.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [Source audit and redevelopment notes](REDEVELOPMENT_PLAN.md)

## License

This project is intended for learning, portfolio demonstration, and further development.

A standalone repository-wide software license has not been selected. Dependencies, bundled assets, and upstream material retain their applicable licenses and notices. Refer to the [source audit](REDEVELOPMENT_PLAN.md) for provenance and dependency licensing.
