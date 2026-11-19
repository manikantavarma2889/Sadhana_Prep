// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage.tsx';

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('../services/session.tsx', () => ({
  useSession: () => ({ user: null, loading: false, signIn: mocks.signIn }),
}));

afterEach(() => { cleanup(); mocks.signIn.mockReset(); });

function openAccountForm() {
  render(<MemoryRouter initialEntries={['/register']}><Routes>
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/dashboard" element={<h1>Workspace opened</h1>} />
  </Routes></MemoryRouter>);
}

it('registers through the form and opens the workspace', async () => {
  mocks.signIn.mockResolvedValue(undefined);
  const user = userEvent.setup();
  openAccountForm();
  await user.type(screen.getByLabelText('Full name'), 'Alex Example');
  await user.type(screen.getByLabelText('Email address'), 'Alex@example.com');
  await user.type(screen.getByLabelText('Password'), 'test-only password');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(mocks.signIn).toHaveBeenCalledWith({ name: 'Alex Example', email: 'alex@example.com', password: 'test-only password' }, true);
  expect(await screen.findByRole('heading', { name: 'Workspace opened' })).toBeInTheDocument();
});

it('displays a failed registration and keeps the form available', async () => {
  mocks.signIn.mockRejectedValue(new Error('An account already exists with that email address.'));
  const user = userEvent.setup();
  openAccountForm();
  await user.type(screen.getByLabelText('Full name'), 'Alex Example');
  await user.type(screen.getByLabelText('Email address'), 'Alex@example.com');
  await user.type(screen.getByLabelText('Password'), 'test-only password');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('An account already exists');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

it('toggles password visibility and shows registration strength without changing the input value', async () => {
  const user = userEvent.setup();
  openAccountForm();
  const input = screen.getByLabelText('Password');
  expect(input).toHaveAttribute('type', 'password');
  await user.type(input, 'short');
  expect(screen.getByRole('status')).toHaveTextContent('Weak');
  await user.clear(input);
  await user.type(input, 'Sample passphrase 56!');
  expect(screen.getByRole('status')).toHaveTextContent('Strong');
  await user.click(screen.getByRole('button', { name: 'Show password' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue('Sample passphrase 56!');
  await user.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue('Sample passphrase 56!');
  expect(mocks.signIn).not.toHaveBeenCalled();
});
