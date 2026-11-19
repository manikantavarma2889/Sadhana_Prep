import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { prismaHeroVideo } from '../../shared/hero-media.ts';

test('opens the video homepage publicly and carries a preparation track through sign-up', async ({ page, browser, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(prismaHeroVideo, route => route.abort());
  const entry = await page.goto('/');
  expect(await entry?.headerValue('content-security-policy')).toContain(prismaHeroVideo);
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle('Sadhana Prep');
  await expect(page.getByRole('heading', { name: 'Sadhana Prep' })).toBeVisible();
  await expect(page.locator('video')).toHaveAttribute('src', prismaHeroVideo);
  await expect(page.locator('video')).toHaveJSProperty('autoplay', false);
  await expect(page.getByRole('button', { name: /background video/ })).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toHaveCount(0);
  const navTop = (await nav.boundingBox())!.y;
  for (const [name, hash] of [['Overview', '#overview'], ['How it works', '#how-it-works'], ['Preparation', '#preparation'], ['About', '#about']]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(url => url.hash === hash);
    await expect(page.getByRole('heading', { name, exact: true })).toBeInViewport();
    expect(Math.abs((await nav.boundingBox())!.y - navTop)).toBeLessThan(2);
    await expect(nav.getByRole('link', { name: 'Sign in' })).toBeInViewport();
  }
  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveCSS('border-top-width', '1px');
  const footerBrand = footer.getByRole('link', { name: 'Sadhana Prep', exact: true });
  await footerBrand.scrollIntoViewIfNeeded();
  const footerMark = footerBrand.locator('img');
  await expect.poll(() => footerMark.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const logoSource = await footerMark.getAttribute('src');
  await expect(footer.getByText('Study the fundamentals. Rehearse for the role.', { exact: true })).toBeVisible();
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('video')).toBeInViewport({ ratio: 0.8 });
  await page.getByRole('heading', { name: 'Overview', exact: true }).scrollIntoViewIfNeeded();
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.locator('video')).toBeInViewport({ ratio: 0.8 });

  await page.getByRole('region', { name: 'Sadhana Prep', exact: true }).getByRole('link', { name: 'Explore preparation' }).click();
  await expect(page).toHaveURL(/\/#preparation$/);
  await expect(page.getByRole('heading', { name: 'Preparation', exact: true })).toBeInViewport();
  const preparation = page.getByRole('region', { name: 'Preparation', exact: true });
  await expect(page.locator('main > section')).toHaveText([
    /^Overview/, /^How it works/, /^Preparation/, /^About/,
  ]);
  const interviews = preparation.getByRole('region', { name: 'Interview tracks' });
  await expect(interviews.getByRole('link')).toHaveCount(6);
  await expect(preparation.getByRole('region', { name: 'Learning tracks' }).getByRole('link')).toHaveCount(5);
  await interviews.getByRole('link', { name: 'Practice System design', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');

  const email = randomUUID() + '@example.com';
  const password = 'Test-only interview password';
  const signIn = page.getByRole('region', { name: 'Welcome back' });
  await expect(signIn.getByText('Don’t have an account?')).toBeVisible();
  const google = signIn.getByRole('button', { name: 'Continue with Google' });
  await expect(google).toBeVisible();
  await expect.poll(() => google.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await signIn.getByRole('link', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Create an account' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByLabel('Full name').fill('Alex Example');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/interviews\/new\?track=system-design$/);
  await expect(page.getByRole('heading', { name: 'New interview' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /System design/ })).toBeChecked();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await nav.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(signIn.getByText('Don’t have an account?')).toBeVisible();
  await expect(signIn.getByRole('link', { name: 'Sign up', exact: true })).toHaveAttribute('href', '/register');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome, Alex' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Prep Hub' }).click();
  await expect(page).toHaveURL(/\/prep-hub$/);
  const sidebarBrand = page.getByRole('link', { name: 'Sadhana Prep dashboard' });
  await expect(sidebarBrand).toHaveText('Sadhana Prep');
  await expect(sidebarBrand.locator('img')).toHaveAttribute('src', logoSource!);
  await sidebarBrand.click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Sadhana Prep home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(nav.getByRole('link', { name: 'Workspace', exact: true })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome, Alex' })).toBeVisible();

  const guest = await browser.newPage({ baseURL, reducedMotion: 'reduce' });
  try {
    await guest.route(prismaHeroVideo, route => route.abort());
    await guest.goto('/');
    await guest.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(guest).toHaveURL(/\/login$/);
    await expect(guest.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  } finally {
    await guest.close();
  }
});

test('opens every interview track from the numeric loopback address and resumes with email sign-in', async ({ page, baseURL }) => {
  const alias = new URL(baseURL!);
  alias.hostname = '127.0.0.1';
  const tracks = ['Backend', 'MERN stack', 'JavaScript / TypeScript', 'System design', 'Behavioral', 'Frontend'];

  for (const label of tracks) {
    await page.goto(alias.origin + '/preparation');
    await expect(page).toHaveURL(alias.origin + '/#preparation');
    await page.getByRole('link', { name: 'Practice ' + label, exact: true }).click();
    await expect(page).toHaveURL(alias.origin + '/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  }
  const email = randomUUID() + '@example.com';
  const password = 'Test-only interview password';
  const signIn = page.getByRole('region', { name: 'Welcome back' });
  await expect(signIn.getByRole('button', { name: 'Try demo' })).toHaveCount(0);
  await signIn.getByRole('link', { name: 'Sign up' }).click();
  await page.getByLabel('Full name').fill('Preview Candidate');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(alias.origin + '/interviews/new?track=frontend');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(alias.origin + '/login');
  await page.goto(alias.origin + '/preparation');
  await page.getByRole('link', { name: 'Practice Frontend', exact: true }).click();
  await signIn.getByLabel('Email address').fill(email);
  await signIn.getByLabel('Password', { exact: true }).fill(password);
  await signIn.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(alias.origin + '/interviews/new?track=frontend');
  await expect(page.getByRole('radio', { name: /Frontend/ })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New interview' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Settings' }).click();
  const security = page.getByRole('region', { name: 'Change password', exact: true });
  const newPassword = 'A new interview password';
  await expect(security.getByLabel('Current password', { exact: true })).toHaveCount(0);
  await security.getByLabel('New password', { exact: true }).fill(newPassword);
  const confirmation = security.getByLabel('Confirm password', { exact: true });
  await confirmation.fill('A mismatched password');
  await security.getByRole('button', { name: 'Change password' }).click();
  await expect(security.getByRole('alert')).toHaveText('The new passwords do not match.');
  await expect(confirmation).toBeFocused();
  await confirmation.fill(newPassword);
  await security.getByRole('button', { name: 'Change password' }).click();
  await expect(security.getByText('Password changed.', { exact: false })).toBeVisible();

  await security.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  await page.getByRole('button', { name: 'Email reset link' }).click();
  await expect(page.getByRole('alert')).toContainText('Email password recovery is not configured');
});

