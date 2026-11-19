# Test record

## Scope and environment

- **Record date:** 19 November 2026, Asia/Kolkata.
- **Application revision:** `7bcba76`, before this documentation update.
- **Environment:** Windows, Node.js 24, npm workspaces, and Chrome through Playwright.
- **Local application:** `http://localhost:3002`.
- **Automated API/unit tests:** in-memory storage and deterministic local coaching unless a disposable `TEST_MONGO_URI` is explicitly provided.
- **Live integration checks:** the deployed application, MongoDB Atlas, and the configured OpenRouter model; synthetic resume content and a temporary test account.

This document records completed checks. It is not a security audit, full browser-compatibility report, or WCAG conformance claim.

## Automated functional checks

| Check | Result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Passed | Backend and frontend TypeScript |
| `npm test` | 23 tests passed | API, domain rules, and account-form tests |
| Frontend production build | Passed | Vite build used by the port 3002 preview |
| Targeted walkthrough browser test | 1 test passed | All three scroll steps, pinned stage, report image loading, footer navigation, and return to top |

The latest unit/API run was repeated outside the restricted Windows execution sandbox after the first attempt could not rename temporary transform files. The completed run is the result reported above.

API/domain coverage includes authentication and session rotation, password change and reset flows, resume parsing and ownership, required setup analysis, changed-setting rejection, duration-based sessions, difficulty progression, duplicate submissions, saved-answer recovery, report evidence, provider cooldown handling, and mocked speech-provider responses.

The frontend tests cover account registration, error feedback, and password visibility/strength behavior. They are functional tests, not a complete accessibility audit.

## Targeted browser and accessibility checks

| Task | Recorded result |
| --- | --- |
| Layout at 390, 1366, 1440, and 1920 CSS pixels | Original section widths restored; no horizontal page overflow; hero and footer geometry retained |
| How it works on desktop and mobile | All three supplied images loaded; active panels fit the tested viewports |
| Plain resume wording | Overview and walkthrough use `resume` without accented spelling |
| Sign-in and sign-up form labels | Targeted accessible-name checks completed |
| Keyboard focus on account controls | Targeted check completed; full-page keyboard coverage pending |
| Reduced-motion homepage behavior | Targeted check completed |
| Guest learning dialog | Targeted open, Escape, and focus-return check completed |

The targeted accessibility checks use Chrome automation and DOM/browser behavior. A person using a screen reader has not validated these results.

## Earlier integration checks on the same date

- A full browser suite run recorded **8 passing tests** during the interview feature update. It was not rerun in full for this documentation-only change; the affected walkthrough test was rerun after the homepage content update.
- A live synthetic resume upload and analysis identified the actual **CampusConnect** project in the fixture.
- The configured real model advanced a session through **8 questions** while it remained active, including technical, resume, and behavioral categories.
- Finishing that session produced a **ready** report with **2 graded submitted answers**.
- The temporary live test account and its owned test data were removed after verification.
- The original desktop section widths were subsequently verified locally and on the live website after the zoom-related layout restoration.

Earlier integration results describe those executions. Provider availability, quotas, and speech accuracy can change.

## Not yet verified

- Complete WCAG 2.2 AA evaluation.
- NVDA, JAWS, VoiceOver, and TalkBack task coverage.
- Full keyboard traversal, focus order, and live announcements across every workspace and interview control.
- Measured color contrast throughout the application, forced colors, and high-contrast modes.
- Real browser zoom at 200%/400% and complete text-spacing/reflow checks.
- Physical iOS/Android devices, Safari, and Firefox.
- Transcription accuracy across different accents, microphones, speech patterns, and languages.

## Reproduce the checks

Run these from the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
```

Stop any application currently listening on port 3002, then run the browser suite:

```powershell
$env:FORGE_E2E_PORT = "3002"
npm run test:e2e
Remove-Item Env:FORGE_E2E_PORT
```

On macOS/Linux, use `FORGE_E2E_PORT=3002 npm run test:e2e`.

To test the MongoDB adapter, set `TEST_MONGO_URI` to a disposable MongoDB instance before `npm test`. The suite creates and removes a generated `forge_test_` database and requires permission to do so. Do not point this test setting at a production database.

See the [project accessibility statement](../ACCESSIBILITY.md#project-accessibility-statement) for known barriers and the reporting route.
