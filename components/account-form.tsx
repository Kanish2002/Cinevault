'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth/client';
import { errorMessage } from '@/lib/utils';
import { Button } from './ui/button';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';
export function AccountForm() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function changeMode(next: Mode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setConfirm('');
    setOtp('');
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setMessage('');
    if ((mode === 'signup' || mode === 'reset') && password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    const address = email.trim().toLowerCase();
    try {
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({ email: address, password, name: address.split('@')[0] })
          : mode === 'signin'
            ? await authClient.signIn.email({ email: address, password })
            : mode === 'forgot'
              ? await authClient.emailOtp.requestPasswordReset({ email: address })
              : await authClient.emailOtp.resetPassword({ email: address, otp, password });
      if (result.error) throw new Error(result.error.message || 'Please retry.');
      setPassword('');
      setConfirm('');
      if (mode === 'forgot') {
        setMode('reset');
        setMessage('If an account exists, a reset code will arrive by email.');
      } else if (mode === 'reset') {
        setMode('signin');
        setOtp('');
        setMessage('Password updated. Sign in with your new password.');
      } else {
        await authClient.getSession({ query: { disableCookieCache: true } });
        setMessage('Account ready. Enable sync below to save this collection to your account.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const title = {
    signin: 'Sign in',
    signup: 'Create account',
    forgot: 'Reset password',
    reset: 'Set new password',
  }[mode];
  return (
    <form onSubmit={(e) => void submit(e)} className="account-form">
      <h3>{title}</h3>
      <p className="small muted">
        Use any email address, including Gmail, with a separate CineVault password.
      </p>
      <label>
        Email address
        <input
          type="email"
          autoComplete="username"
          value={email}
          maxLength={254}
          required
          disabled={busy || mode === 'reset'}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {mode === 'reset' && (
        <label>
          Email reset code
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={otp}
            disabled={busy}
            onChange={(e) => setOtp(e.target.value)}
          />
        </label>
      )}
      {mode !== 'forgot' && (
        <label>
          {mode === 'reset' ? 'New CineVault password' : 'CineVault password'}
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signin' ? 1 : 10}
            maxLength={128}
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      {(mode === 'signup' || mode === 'reset') && (
        <>
          <p className="small muted">At least 10 characters.</p>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
              value={confirm}
              disabled={busy}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="inline-actions">
        <Button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : title}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Create account' : 'Back to sign in'}
        </Button>
      </div>
      {mode === 'signin' && (
        <Button type="button" variant="ghost" disabled={busy} onClick={() => changeMode('forgot')}>
          Forgot password?
        </Button>
      )}
    </form>
  );
}
