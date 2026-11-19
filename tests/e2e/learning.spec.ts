import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { referenceProblems } from '../../frontend/src/features/dsa-sheet-content.ts';
import { prismaHeroVideo } from '../../shared/hero-media.ts';

test('moves through all three walkthrough steps in the same stage and shows the footer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(prismaHeroVideo, route => route.abort());
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'How it works' }).click();

  const section = page.getByRole('region', { name: 'How it works' });
  await expect(section.getByRole('heading', { name: 'Set up and analyze your interview' })).toBeInViewport();
  const runway = section.locator('.walkthrough-runway');
  const stage = section.locator('.walkthrough-stage');
  const scrollToStep = (ratio: number) => runway.evaluate((track, progress) => {
    const panel = track.querySelector<HTMLElement>('.walkthrough-stage')!;
    const offset = Number.parseFloat(getComputedStyle(panel).top);
    window.scrollTo(0, window.scrollY + track.getBoundingClientRect().top - offset + (track.clientHeight - panel.clientHeight) * progress);
  }, ratio);

  await scrollToStep(.5);
  await expect(section.getByRole('heading', { name: 'Practice a conversation with Sadhana' })).toBeInViewport();
  const pinnedTop = (await stage.boundingBox())!.y;
  await scrollToStep(.94);
  await expect(section.getByRole('heading', { name: 'Turn your feedback into a practice plan' })).toBeInViewport();
  expect(Math.abs((await stage.boundingBox())!.y - pinnedTop)).toBeLessThan(2);
  const sample = section.getByRole('img', { name: /Sadhana Prep interview summary/ });
  await expect.poll(() => sample.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  const footer = page.getByRole('contentinfo');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole('link', { name: 'DSA Study Sheet' })).toHaveAttribute('href', '/preparation/dsa');
  await footer.getByRole('button', { name: 'Back to top' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('previews each track, gates learning content, and resumes the exact DSA problem after signup', async ({ page, request }) => {
  await page.goto('/preparation');
  const learning = page.getByRole('region', { name: 'Learning tracks' });
  const previewItems = [
    ['Database Management', 'Keys and referential integrity'],
    ['Operating Systems', 'Processes and threads'],
    ['Computer Networks', 'From frames to application messages'],
  ];
  for (const [track, item] of previewItems) {
    await learning.getByRole('link', { name: new RegExp(track) }).click();
    await expect(page.getByRole('heading', { name: track, exact: true })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(item) }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in to keep learning' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep browsing' }).click();
    await page.getByRole('link', { name: 'Preparation', exact: true }).first().click();
  }

  await learning.getByRole('link', { name: /DSA Study Sheet/ }).click();
  await expect(page.getByRole('heading', { name: 'DSA pattern breakdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Two pointers' })).toBeVisible();
  await page.getByRole('link', { name: 'DSA sheet', exact: true }).click();
  await expect(page.getByRole('row')).toHaveCount(7);
  expect((await request.get('/api/v1/learning/dsa/pair-target')).status()).toBe(401);

  const boundary = page.getByRole('button', { name: 'Sign in to continue' });
  await boundary.evaluate(element => element.scrollIntoView({ block: 'end' }));
  const gate = page.getByRole('dialog', { name: 'Sign in to keep learning' });
  await expect(gate).toBeVisible();
  await gate.getByRole('button', { name: 'Keep browsing' }).click();
  await expect(gate).toHaveCount(0);
  await page.getByRole('button', { name: 'View approach for Two Sum', exact: true }).click();
  await gate.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('region', { name: 'Welcome back' }).getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Jordan Example');
  await page.getByLabel('Email address').fill(randomUUID() + '@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Test-only interview password');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/prep-hub\/dsa\?view=sheet&item=pair-target&panel=approach$/);
  const problem = page.getByRole('dialog', { name: 'Two Sum' });
  await expect(problem.getByRole('heading', { name: 'Approach' })).toBeVisible();
  await expect(problem.getByRole('heading', { name: 'Python solution' })).toBeVisible();
  await problem.getByRole('button', { name: 'Mark as solved' }).click();
  await problem.getByRole('button', { name: 'Bookmark', exact: true }).click();
  await problem.getByRole('button', { name: 'Resources' }).click();
  await expect(problem.getByRole('link', { name: 'Open LeetCode' })).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/');
  await expect(problem.getByRole('link', { name: 'Open GFG' })).toHaveAttribute('href', 'https://www.geeksforgeeks.org/?s=Two%20Sum');
  await expect(problem.getByRole('link', { name: 'Watch solutions' })).toHaveAttribute('href', /youtube\.com\/results\?search_query=Two%20Sum/);
  await problem.getByRole('button', { name: 'Remove Duplicates from Sorted Array', exact: true }).click();
  const related = page.getByRole('dialog', { name: 'Remove Duplicates from Sorted Array', exact: true });
  await expect(related.getByRole('button', { name: 'Description' })).toHaveAttribute('aria-pressed', 'true');
  await related.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'View approach for Maximum Subarray', exact: true }).click();
  const walkthrough = page.getByRole('dialog', { name: 'Maximum Subarray' });
  await expect(walkthrough.getByRole('heading', { name: 'Python solution' })).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await walkthrough.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(walkthrough.getByRole('status')).toHaveText('Solution copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('def maxSubArray');
  await walkthrough.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('progressbar', { name: 'DSA problems solved', exact: true })).toHaveAttribute('value', '1');
  await expect(page.getByRole('progressbar', { name: 'DSA problems solved', exact: true })).toHaveAttribute('max', '305');
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox', { name: 'Search problems' })).toBeFocused();
  await page.getByRole('searchbox', { name: 'Search problems' }).fill('rainwater');
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Trapping Rain Water', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search problems' }).clear();
  await page.getByRole('button', { name: 'Show bookmarked problems' }).click();
  await expect(page.getByRole('row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Show bookmarked problems' }).click();
  const sheet = page.getByRole('region', { name: 'DSA practice set' });
  const visibleProblems = sheet.locator('tbody .dsa-problem-title');
  await expect(visibleProblems).toHaveCount(305);
  await expect(sheet.locator('tbody tr[data-featured=true]')).toHaveCount(1);
  const titles = (await visibleProblems.allTextContents()).map(title => title.replace(/^\d+\. /, '').replace(/POTD$/, ''));
  expect(titles.slice(0, referenceProblems.length)).toEqual(referenceProblems.map(([title]) => title));
  await expect(sheet.getByRole('link', { name: 'LeetCode resources for Count Subarrays with Given XOR', exact: true }))
    .toHaveAttribute('href', 'https://leetcode.com/problemset/?search=Count%20Subarrays%20with%20Given%20XOR');
  await sheet.getByRole('combobox', { name: 'Problems per page' }).selectOption('12');
  await sheet.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(sheet.getByText('Showing 13–24 of 305')).toBeVisible();
  await sheet.getByRole('button', { name: 'Pattern Based' }).click();
  await expect(sheet.locator('tr.dsa-group-row').first()).toHaveText('Arrays');
  await sheet.getByRole('button', { name: 'Asked Frequency' }).click();
  await expect(sheet.getByRole('columnheader', { name: 'Frequency' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore Company Prep' }).click();
  const companyPlan = page.getByRole('dialog', { name: 'Build a company prep plan' });
  await companyPlan.getByLabel('Target company').selectOption('Google');
  await companyPlan.getByRole('button', { name: /90 days/ }).click();
  await companyPlan.getByRole('button', { name: 'Start prep plan' }).click();
  await expect(sheet.getByRole('button', { name: '90-day Google plan' })).toBeVisible();

  const workspaceNav = page.getByRole('navigation', { name: 'Workspace' });
  await expect(workspaceNav.getByRole('link', { name: 'Prep Hub' })).toHaveAttribute('aria-current', 'page');
  await workspaceNav.getByRole('link', { name: 'Prep Hub' }).click();
  await expect(page.getByRole('heading', { name: 'Prep Hub', exact: true })).toBeVisible();
  await expect(learning.getByRole('link')).toHaveCount(5);
  await learning.getByRole('link', { name: /System Design/ }).click();
  await expect(page.getByRole('heading', { name: 'How a Request Travels' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Users say the shop feels slow' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course lessons' }).locator('.design-module-toggle')).toHaveCount(9);
  const visualization = page.getByRole('region', { name: 'Lesson visualization' });
  await expect(visualization.getByRole('img', { name: /Architecture diagram: .*laptop/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next: Find address' }).click();
  await expect(page.getByRole('heading', { name: 'DNS: the internet’s phone book' })).toBeVisible();
  await expect(visualization.getByRole('img', { name: /DNS resolver/ })).toBeVisible();
  await visualization.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(visualization.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await visualization.getByRole('button', { name: 'Replay' }).click();
  await expect(visualization.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'What DNS does and why it is cached' }).check();
  await page.getByRole('region', { name: 'Lesson steps' }).getByRole('button', { name: '10 Recap' }).click();
  await page.getByRole('button', { name: 'Finish lesson' }).click();
  await expect(page.getByText('Lesson complete', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next lesson: Latency & Throughput' }).click();
  await expect(page.getByRole('heading', { name: 'Latency & Throughput' })).toBeVisible();
  const courseOutline = page.getByRole('navigation', { name: 'Course lessons' });
  await courseOutline.getByRole('button', { name: /Whole Systems/ }).click();
  await courseOutline.getByRole('button', { name: 'Design a Rate Limiter' }).click();
  await expect(page.getByRole('heading', { name: 'Design a Rate Limiter' })).toBeVisible();
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: /Short links/ }).click();
  await expect(page.getByRole('dialog', { name: 'Short links' }).getByRole('heading', { name: 'Discuss the trade-off' })).toBeVisible();

  await page.goto('/preparation/os');
  await expect(page).toHaveURL(/\/prep-hub\/os$/);
  await expect(workspaceNav.getByRole('link', { name: 'Prep Hub' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /File descriptors and buffered I\/O/ })).toBeVisible();

  await workspaceNav.getByRole('link', { name: 'Overview', exact: true }).click();
  const progress = page.getByRole('region', { name: 'Prep Hub Progress' });
  await expect(progress.getByRole('progressbar', { name: 'Prep Hub completion' })).toHaveAttribute('value', '2');
  await expect(progress.getByRole('progressbar', { name: 'DSA Study Sheet completion' })).toHaveAttribute('value', '1');
  await expect(progress.getByRole('progressbar', { name: 'System Design completion' })).toHaveAttribute('value', '1');
  await expect(progress.getByRole('progressbar', { name: 'System Design completion' })).toHaveAttribute('max', '48');
  const pinned = page.getByRole('region', { name: 'Pinned subjects' });
  await pinned.getByText('Pin a subject', { exact: true }).click();
  await pinned.getByRole('button', { name: 'DSA Study Sheet', exact: true }).click();
  await page.reload();
  await expect(pinned.getByRole('link', { name: 'DSA Study Sheet' })).toHaveAttribute('href', '/prep-hub/dsa');
});

