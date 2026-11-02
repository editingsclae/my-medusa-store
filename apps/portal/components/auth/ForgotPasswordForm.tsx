'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from '@/components/icons';
import { confirmMerchantPasswordReset, requestMerchantPasswordReset } from '@/lib/medusa';
import { checkNewPassword, cleanCode, friendlyError, isCompleteCode } from '@/lib/password-reset';

type Step = 'email' | 'code' | 'done';

const LABEL: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: '20px',
  color: '#1F2937',
  marginBottom: '8px',
  display: 'block',
};

const FIELD: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  height: '48px',
  borderRadius: '24px',
  border: '1px solid #E6E8EC',
  background: '#FFFFFF',
  padding: '0 15px',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const INPUT: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: '16px',
  color: '#111827',
};

const PRIMARY_BUTTON: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '48px',
  borderRadius: '24px',
  background: 'var(--accent)',
  color: '#FFFFFF',
  border: 0,
  fontSize: '16px',
  fontWeight: 500,
  fontFamily: 'inherit',
  textDecoration: 'none',
  transition: 'opacity 0.15s ease, transform 0.1s ease',
};

const TEXT_BUTTON: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#4B5263',
  fontSize: '14px',
  fontWeight: 500,
  padding: '8px',
  fontFamily: 'inherit',
};

const LINK_ACCENT: React.CSSProperties = {
  fontWeight: 600,
  color: 'color-mix(in srgb, var(--accent) 82%, black)',
  textDecoration: 'none',
};

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Seconds until a new code may be asked for (the backend allows one a minute)
  const [cooldown, setCooldown] = useState(0);

  const counting = cooldown > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  // Asks for a code. Returns true when the request went through.
  const askForCode = async (): Promise<boolean> => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await requestMerchantPasswordReset(email.trim());
      setCooldown(Math.max(0, res.can_resend_in || 60));
      return true;
    } catch (err) {
      setError(friendlyError(err, 'We could not send the code. Try again.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (await askForCode()) {
      setCode('');
      setStep('code');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    if (await askForCode()) {
      setNotice('If that email has an account, a new code is on its way.');
    }
  };

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice(null);
    if (!isCompleteCode(code)) {
      setError('Enter the 6 digit code from the email.');
      return;
    }
    const problem = checkNewPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await confirmMerchantPasswordReset({ email: email.trim(), code: cleanCode(code), password });
      setPassword('');
      setConfirm('');
      setCode('');
      setStep('done');
    } catch (err) {
      setError(friendlyError(err, 'We could not change the password. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const errorBox = error ? (
    <div
      role="alert"
      style={{
        padding: '10px 14px',
        borderRadius: '12px',
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        color: '#991B1B',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      {error}
    </div>
  ) : null;

  const noticeBox = notice ? (
    <div
      role="status"
      style={{
        padding: '10px 14px',
        borderRadius: '12px',
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        color: '#166534',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      {notice}
    </div>
  ) : null;

  return (
    <main
      style={{
        flex: '1 1 58%',
        minWidth: 'min(380px, 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        boxSizing: 'border-box',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px',
          background: '#FFFFFF',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          boxSizing: 'border-box',
          boxShadow: '0 2px 8px rgba(17, 24, 39, 0.04)',
        }}
      >
        {step === 'email' && (
          <>
            <div>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4B5263',
                  textDecoration: 'none',
                  marginBottom: '20px',
                }}
              >
                <ArrowLeftIcon />
                Back to sign in
              </Link>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, lineHeight: '36px', color: '#111827' }}>
                Forgot password?
              </h1>
              <p style={{ margin: '8px 0 0 0', fontSize: '16px', fontWeight: 500, lineHeight: '24px', color: '#4B5263' }}>
                Enter the email address of your account and we&apos;ll email you a 6 digit code to choose a new password.
              </p>
            </div>

            <form noValidate onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="reset-email" style={LABEL}>
                  Email address
                </label>
                <div className="dl-field" style={FIELD}>
                  <span style={{ color: '#2A3040', display: 'flex', alignItems: 'center', flex: 'none' }}>
                    <MailIcon />
                  </span>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={INPUT}
                  />
                </div>
              </div>

              {errorBox}

              <button
                type="submit"
                disabled={loading}
                style={{ ...PRIMARY_BUTTON, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.8 : 1 }}
              >
                {loading ? 'Sending code...' : 'Send code'}
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 500, color: '#4B5263' }}>
              Remember your password?{' '}
              <Link href="/login" style={LINK_ACCENT}>
                Sign in
              </Link>
            </div>
          </>
        )}

        {step === 'code' && (
          <>
            <div>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setError(null);
                  setNotice(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4B5263',
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  marginBottom: '20px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeftIcon />
                Use another email
              </button>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, lineHeight: '36px', color: '#111827' }}>
                Check your email
              </h1>
              <p style={{ margin: '8px 0 0 0', fontSize: '15px', fontWeight: 500, lineHeight: '22px', color: '#4B5263' }}>
                If <span style={{ fontWeight: 600, color: '#111827' }}>{email.trim()}</span> has an account, we sent it a 6
                digit code. It works for 15 minutes.
              </p>
            </div>

            <form noValidate onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="reset-code" style={LABEL}>
                  6 digit code
                </label>
                <div className="dl-field" style={FIELD}>
                  <input
                    id="reset-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(cleanCode(e.target.value))}
                    placeholder="123456"
                    style={{ ...INPUT, letterSpacing: '6px', fontWeight: 600, textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="reset-password" style={LABEL}>
                  New password
                </label>
                <div className="dl-field" style={{ ...FIELD, padding: '0 8px 0 15px' }}>
                  <span style={{ color: '#2A3040', display: 'flex', alignItems: 'center', flex: 'none' }}>
                    <LockIcon />
                  </span>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: '#4B5263',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="reset-confirm" style={LABEL}>
                  Repeat the new password
                </label>
                <div className="dl-field" style={FIELD}>
                  <span style={{ color: '#2A3040', display: 'flex', alignItems: 'center', flex: 'none' }}>
                    <LockIcon />
                  </span>
                  <input
                    id="reset-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Type it again"
                    style={INPUT}
                  />
                </div>
              </div>

              {errorBox}
              {noticeBox}

              <button
                type="submit"
                disabled={loading}
                style={{ ...PRIMARY_BUTTON, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.8 : 1 }}
              >
                {loading ? 'Changing password...' : 'Change password'}
              </button>
            </form>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                style={{ ...TEXT_BUTTON, cursor: cooldown > 0 || loading ? 'default' : 'pointer' }}
              >
                Didn&apos;t get it?{' '}
                <span style={{ ...LINK_ACCENT, opacity: cooldown > 0 ? 0.55 : 1 }}>
                  {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                </span>
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleIcon width={32} height={32} />
            </div>

            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, lineHeight: '32px', color: '#111827' }}>
                Password changed
              </h1>
              <p style={{ margin: '10px 0 0 0', fontSize: '15px', fontWeight: 500, lineHeight: '22px', color: '#4B5263' }}>
                You can now sign in to <span style={{ fontWeight: 600, color: '#111827' }}>{email.trim()}</span> with your new
                password.
              </p>
            </div>

            <Link href="/login" style={{ ...PRIMARY_BUTTON, width: '100%', boxSizing: 'border-box' }}>
              Go to sign in
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
