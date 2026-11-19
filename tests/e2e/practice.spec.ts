import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { syntheticResume } from '../fixtures/resume.ts';

async function register(page: Page) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Alex Example');
  await page.getByLabel('Email address').fill(randomUUID() + '@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Test-only interview password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Alex' })).toBeVisible();
}

test('uses a resume in an interview, safely retries a lost response and shows answer evidence', async ({ page }) => {
  await page.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (!constraints?.video) return original(constraints);
      const stream = document.createElement('canvas').captureStream();
      Object.assign(window, { interviewTestTrack: stream.getVideoTracks()[0] });
      return stream;
    };
  });
  await register(page);
  await page.getByRole('link', { name: 'Resume library', exact: true }).click();
  await page.getByLabel('Choose a PDF resume').setInputFiles({
    name: 'example.pdf', mimeType: 'application/pdf', buffer: syntheticResume(),
  });
  await page.getByRole('button', { name: 'Upload and extract' }).click();
  await expect(page.getByText('TypeScript', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'New interview', exact: true }).click();
  await page.getByLabel('Role title', { exact: true }).fill('Full-stack Engineer');
  await page.getByLabel('Job description', { exact: true }).fill('React and Docker are required. Preferred qualifications include Kubernetes.');
  await page.getByRole('combobox', { name: 'Resume profile', exact: true }).selectOption({ label: 'example' });
  await page.getByRole('button', { name: 'Analyze job description' }).click();
  await expect(page.getByText('Skill gaps to practice')).toBeVisible();
  await page.getByLabel('Duration').selectOption('30');
  await expect(page.getByText('5 planned questions.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start interview' }).click();
  const lobby = page.getByRole('dialog', { name: 'Ready to join?' });
  await expect(lobby.getByText('Sadhana AI is ready', { exact: true })).toBeVisible();
  await lobby.getByRole('button', { name: 'Other ways to join' }).click();
  await lobby.getByRole('button', { name: 'Back to setup' }).click();
  await expect(page.getByLabel('Duration')).toHaveValue('30');
  await page.getByRole('button', { name: 'Start interview' }).click();
  await lobby.getByRole('button', { name: 'Turn on camera' }).click();
  await expect(lobby.locator('video')).toBeVisible();
  await lobby.getByRole('button', { name: 'Other ways to join' }).click();
  await lobby.getByRole('checkbox', { name: 'Let Sadhana AI speak questions aloud' }).uncheck();
  await lobby.getByRole('button', { name: 'Ask to join' }).click();
  await expect(page.getByRole('heading', { name: /Question 1.*interested in the Full-stack Engineer role/ })).toBeVisible();
  await expect(page.getByText('Question 1 of 5', { exact: true })).toBeVisible();
  await expect(page.locator('.tile.self video')).toBeVisible();
  await page.getByRole('button', { name: 'Activities' }).click();
  await expect(page.getByRole('complementary', { name: 'Activities' }).getByText('30 minutes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip question' }).click();
  await expect(page.getByRole('heading', { name: /How would you use Docker/ })).toBeVisible();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  const answer = 'I would build the image once.';
  await page.getByLabel('Your answer').fill(answer);
  let lost = false;
  await page.route('**/answers', async route => {
    if (lost) return route.continue();
    lost = true;
    const upstream = await route.fetch();
    expect(upstream.ok()).toBeTruthy();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not reach Sadhana Prep');
  await expect(page.getByLabel('Your answer')).toHaveValue(answer);
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
  await expect(page.getByText('Question 2 of 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Turn off camera' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { interviewTestTrack?: MediaStreamTrack }).interviewTestTrack?.readyState)).toBe('ended');
  await page.reload();
  await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
  await expect(page.locator('.meet-turn')).toHaveCount(2);
  await page.getByRole('button', { name: 'End interview' }).click();
  await expect(page.getByRole('heading', { name: 'Interview summary' })).toBeVisible();
  await expect(page.locator('.evidence blockquote').first()).toHaveText(answer);
  await expect(page.getByText('1 of 1 submitted answers received a rubric score.')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download transcript' }).click();
  expect((await downloaded).suggestedFilename()).toBe('sadhana-ai-interview-transcript.txt');
  await page.getByRole('link', { name: 'Exit', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Overview' }).click();
  const progress = page.getByRole('region', { name: 'Interview Progress' });
  await expect(progress.getByRole('img', { name: '1 of 1 recent interviews completed' })).toBeVisible();
});

test('keeps text answers available when microphone permission is denied', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await register(page);
  await page.getByRole('link', { name: 'New interview', exact: true }).click();
  await page.getByRole('button', { name: 'Start interview' }).click();
  await page.getByRole('button', { name: 'Other ways to join' }).click();
  await page.getByRole('checkbox', { name: 'Let Sadhana AI speak questions aloud' }).uncheck();
  await page.getByRole('button', { name: 'Ask to join' }).click();
  await expect(page.getByRole('button', { name: 'Record answer' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Record answer' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access is unavailable');
  await page.getByLabel('Your answer').fill('I would check stale cached data and invalidate the related query.');
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByText('Question 2 of 4', { exact: true })).toBeVisible();
});

type VoiceTestWindow = Window & {
  interviewSpoken: string[];
  finishInterviewSpeech(): void;
  startInterviewAnswer(): void;
};

for (const playbackBlocked of [false, true]) {
  test(playbackBlocked ? 'retries blocked playback before opening the microphone'
    : 'finishes each spoken message before chat and transcribes recorded speech locally', async ({ page }) => {
    test.setTimeout(60_000);
    const sample = Array.from(readFileSync(new URL('../fixtures/spoken-answer.wav', import.meta.url)));
    await page.addInitScript(({ blocked, sample }) => {
      const spoken: string[] = [];
      Object.assign(window, { interviewSpoken: spoken });
      window.speechSynthesis.speak = prompt => {
        spoken.push(prompt.text);
        Object.assign(window, { finishInterviewSpeech: () => prompt.onend?.(new Event('end') as SpeechSynthesisEvent) });
        window.setTimeout(() => {
          if (blocked && spoken.length === 1) {
            prompt.onerror?.(new SpeechSynthesisErrorEvent('error', { error: 'not-allowed', utterance: prompt }));
          } else prompt.onstart?.(new Event('start') as SpeechSynthesisEvent);
        }, 20);
      };
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        await context.resume();
        const buffer = await context.decodeAudioData(Uint8Array.from(sample).buffer);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const output = context.createMediaStreamDestination();
        source.connect(output);
        Object.assign(window, { startInterviewAnswer: () => source.start(context.currentTime + 0.1) });
        return output.stream;
      };
    }, { blocked: playbackBlocked, sample });
    await register(page);
    await page.getByRole('link', { name: 'New interview', exact: true }).click();
    await page.getByLabel('Role title', { exact: true }).fill('Software Engineer');
    await page.getByLabel('Job description', { exact: true }).fill('Work with the team to build accessible software in React and share technical decisions.');
    await page.getByRole('button', { name: 'Analyze job description' }).click();
    await expect(page.getByRole('heading', { name: 'Software Engineer', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: /Behavioral/ }).check();
    await page.getByRole('button', { name: 'Start interview' }).click();
    await page.getByRole('button', { name: 'Ask to join' }).click();
    const chat = page.getByRole('complementary', { name: 'In-call messages' });
    const introduction = chat.getByText(/^Hi Alex Example, I’m Sadhana/);
    const firstQuestion = chat.getByText(/^Question 1\./);
    await expect(page.getByRole('button', { name: 'Record answer' })).toBeDisabled();
    await expect(introduction).toHaveCount(0);
    await expect(firstQuestion).toHaveCount(0);
    if (playbackBlocked) {
      await page.getByRole('button', { name: 'Play question' }).click();
      await expect(page.getByRole('button', { name: 'Play question' })).toHaveCount(0);
    }
    await page.evaluate(() => (window as VoiceTestWindow).finishInterviewSpeech());
    await expect(introduction).toBeVisible();
    await expect(firstQuestion).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Record answer' })).toBeDisabled();
    await expect(page.locator('.captions h1')).toHaveText('Question 1. To start, please tell me a little about yourself and why you are interested in the Software Engineer role.');
    await page.evaluate(() => (window as VoiceTestWindow).finishInterviewSpeech());
    await expect(firstQuestion).toBeVisible();
    await expect(page.getByText('Your turn — listening…', { exact: true })).toBeVisible({ timeout: 25_000 });
    // Silence must keep the question open and allow another attempt.
    await page.getByRole('button', { name: 'Done answering' }).click();
    await expect(page.getByText('Your turn — listening…', { exact: true })).toBeVisible();
    await expect(page.getByText('No transcript was captured.', { exact: false })).toHaveCount(0);
    await expect(page.locator('audio[aria-label="Your recorded answer"]')).toHaveCount(0);
    await page.evaluate(() => (window as VoiceTestWindow).startInterviewAnswer());
    await expect(page.locator('.meet-live-caption')).toHaveText(/Alex Example.*software problems/i, { timeout: 15_000 });
    await expect(chat.getByText(/solving software problems/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Done answering' }).click();
    await expect(chat.getByText(/solving software problems/i)).toBeVisible();
    await expect(page.getByText('Question 2 of 4', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'End interview' }).click();
    await expect(page.getByRole('heading', { name: 'Interview summary' })).toBeVisible();
    await page.getByRole('link', { name: 'Exit', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
  });
}
